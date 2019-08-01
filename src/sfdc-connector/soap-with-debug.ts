import * as XML from 'node-salesforce-connection/xml'

export default async function (conn: any, wsdl: any, method: string, args: any, { headers }: any = {}) {
  const httpsOptions = {
    host: conn.instanceHostname,
    path: wsdl.servicePortAddress,
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml',
      'SOAPAction': '""'
    }
  }
  const sessionHeader = { SessionHeader: { sessionId: conn.sessionId } }
  const requestBody = XML.stringify({
    name: 'soapenv:Envelope',
    attributes: ' xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' + wsdl.targetNamespaces,
    value: {
      'soapenv:Header': Object.assign({}, sessionHeader, headers),
      'soapenv:Body': { [method]: args }
    }
  })
  const response = await conn._request(httpsOptions, requestBody)
  const res = XML.parse(response.body.toString())
  const resBody = res.value['soapenv:Body']
  const resLog = res.value['soapenv:Header'] && res.value['soapenv:Header'].DebuggingInfo && res.value['soapenv:Header'].DebuggingInfo.debugLog

  if (response.statusCode === 200) {
    if (resLog) {
      return {
        body: resBody[method + 'Response'].result,
        debugLog: resLog
      }
    } else {
      return resBody[method + 'Response'].result
    }
  } else {
    const err = new Error() as any
    err.name = 'SalesforceSoapError'
    err.message = resBody['soapenv:Fault'].faultstring
    err.detail = resBody['soapenv:Fault']
    err.response = response
    throw err
  }
}
