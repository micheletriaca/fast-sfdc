import changeCredentials from './change-credentials'
import removeCredentials from './remove-credentials'
import compile from './compile'
import createAuraDefinition from './create-aura-definition'
import createMeta from './create-metadata'
import credentials from './credentials'
import deploy from './deploy'
import deploySelected from './deploy-selected'
import destroySelected from './destroy-selected'
import executeAnonymous from './execute-anonymous'
import initSfdy from './init-sfdy'
import retrieve from './retrieve'
import retrieveSelected from './retrieve-selected'
import configureStaticResourceBundles from './static-resource-bundles'
import runTest from './run-test'
import { reporter } from '../logger'

export default new Proxy({
  changeCredentials,
  removeCredentials,
  compile,
  createAuraDefinition,
  createMeta,
  credentials,
  deploy,
  deploySelected,
  destroySelected,
  executeAnonymous,
  initSfdy,
  retrieve,
  retrieveSelected,
  runTest,
  configureStaticResourceBundles
}, {
  get: (...args) => new Proxy(Reflect.get(...args), {
    apply: (t2, ...args2) => {
      Reflect.apply(t2, ...args2)
      reporter.sendEvent(t2.name)
    }
  })
})
