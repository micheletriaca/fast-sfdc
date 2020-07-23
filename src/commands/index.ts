import manageCredentials from './manage-credentials'
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
import { TextDocument, Uri } from 'vscode'
import * as vscode from 'vscode'

export default {
  manageCredentials: () => {
    reporter.sendEvent('manageCredentials')
    manageCredentials()
  },
  removeCredentials: () => {
    reporter.sendEvent('removeCredentials')
    removeCredentials()
  },
  compile: (doc: TextDocument) => {
    reporter.sendEvent('compile')
    compile(doc)
  },
  createAuraDefinition: (docUri: Uri) => {
    reporter.sendEvent('createAuraDefinition')
    createAuraDefinition(docUri)
  },
  createMeta: () => {
    reporter.sendEvent('createMeta')
    createMeta()
  },
  credentials: (addMode = false) => {
    reporter.sendEvent('credentials')
    credentials(addMode)
  },
  deploy: (checkOnly = false, destructive = false, files: string[] = []) => {
    reporter.sendEvent('deploy')
    deploy(checkOnly, destructive, files)
  },
  deploySelected: (uri: vscode.Uri, allUris: vscode.Uri[], destructive = false) => {
    reporter.sendEvent('deploySelected')
    deploySelected(uri, allUris, destructive = false)
  },
  destroySelected: (uri: vscode.Uri, allUris: vscode.Uri[]) => {
    reporter.sendEvent('destroySelected')
    destroySelected(uri, allUris)
  },
  executeAnonymous: () => {
    reporter.sendEvent('executeAnonymous')
    executeAnonymous()
  },
  initSfdy: () => {
    reporter.sendEvent('initSfdy')
    initSfdy()
  },
  retrieve: (files: string[] = [], filesAreMeta = false) => {
    reporter.sendEvent('retrieve')
    retrieve(files, filesAreMeta)
  },
  retrieveSelected: (uri: vscode.Uri, allUris: vscode.Uri[]) => {
    reporter.sendEvent('retrieveSelected')
    retrieveSelected(uri, allUris)
  },
  runTest: (document: vscode.TextDocument, className: string, methodName: string) => {
    reporter.sendEvent('runTest')
    runTest(document, className, methodName)
  },
  configureStaticResourceBundles: () => {
    reporter.sendEvent('configureStaticResourceBundles')
    configureStaticResourceBundles()
  }
}
