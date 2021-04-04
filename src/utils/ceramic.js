import CeramicClient from '@ceramicnetwork/http-client'
import * as nearApiJs from 'near-api-js'
import { get, set, del } from './storage'
import { IDX } from '@ceramicstudio/idx'
import { createDefinition, publishSchema } from '@ceramicstudio/idx-tools'
import { Ed25519Provider } from 'key-did-provider-ed25519'

// schemas
import { profileSchema } from '../schemas/profile'
import { accountKeysSchema } from '../schemas/accountKeys'
import { definitionsSchema } from '../schemas/definitions'
import { schemaSchema } from '../schemas/schemas'

import { config } from '../state/config'
const axios = require('axios').default;

export const {
    FUNDING_DATA, FUNDING_DATA_BACKUP, ACCOUNT_LINKS, GAS, SEED_PHRASE_LOCAL_COPY,
    networkId, nodeUrl, walletUrl, nameSuffix,
    contractName, didRegistryContractName
} = config

const {
  KeyPair,
  InMemorySigner,
  transactions: {
      addKey
  },
  utils: {
      PublicKey,
      format: {
          parseNearAmount, formatNearAmount
      }
  }
} = nearApiJs

class Ceramic {

  async storeSeedSecret(idx, payload, key, did) {
    console.log('did seed secret', did)
    console.log('key', key)
    console.log('store seed started')
    let record = await idx.get(key, idx._ceramic.did.id)
    console.log('record', record)
    if(!record){
      record = { seeds: [] }
    }
   
    const secretData = { did, payload }
    console.log('secretData', secretData)
    let access = [idx._ceramic.did.id]
    if(did) access.push(did)
    const jwe = await idx._ceramic.did.createDagJWE(secretData, access)
  
    record.seeds.push(jwe)
    console.log('record at end', record)
    await idx.set(key, record)
  }

  async storeKeysSecret(idx, payload, key, did) {

    let record = await idx.get(key)
    
    if(!record){
      record = { seeds: [] }
    }
   
    let access = [idx._ceramic.did.id]
    if(did) access.push(did)
    const jwe = await idx._ceramic.did.createDagJWE(payload, access)
  
    record = { seeds: [jwe] }
  
    await idx.set(key, record)
  }
  
  async downloadSecret(idx, key, did) {
  
    let records = await idx.get(key)
   
    if(records){
      let i = 0
  
      while(i < records.seeds.length) {
        let record = await idx._ceramic.did.decryptDagJWE(records.seeds[i])
        if (record.did == did) {
          return record.payload
        }
        i++
      }
    }
    return false
  }

  async downloadKeysSecret(idx, key) {
    let records = await idx.get(key)
    if(records){
      return await idx._ceramic.did.decryptDagJWE(records.seeds[0])
    }
    return []
  }

  async getSeed(account) {
    const secretKey = localStorage.getItem('nearprofile:seed:'+account.accountId)
    let seed = Buffer.from(secretKey.slice(0, 32))
    return seed
  }

  async getLocalAccountSeed(accountId){
    let accounts = get(ACCOUNT_LINKS, [])
    let i = 0
    while (i < accounts.length){
      if(accounts[i].accountId == accountId){
        let seed = Buffer.from((accounts[i].key).slice(0,32))
        return seed
      }
      i++
    }
    return false
  }

  async getCeramic(account, seed) {
    if(seed == undefined) {
      seed = await this.getSeed(account)
    }
    const API_URL = 'https://ceramic-clay.3boxlabs.com'
    const ceramic = new CeramicClient(API_URL, {cacheDocCommits: true, docSyncEnabled: false, docSynchInterval: 30000})
    const provider = new Ed25519Provider(seed)
    await ceramic.setDIDProvider(provider)
    return ceramic
  }

  async getAppCeramic() {
    let retrieveSeed = await axios.get('https://vpbackend.azurewebsites.net/appseed')
    const seed = Buffer.from((retrieveSeed.data.value).slice(0, 32))
    const API_URL = 'https://ceramic-clay.3boxlabs.com'
    const ceramic = new CeramicClient(API_URL, {docSyncEnabled: false, docSynchInterval: 30000})
    const provider = new Ed25519Provider(seed)
    await ceramic.setDIDProvider(provider)
    return ceramic
  }

  async associateDID(accountId, contract, ceramic) {

    // ensure it's registered in the contract, if not, put it back there
    let exists = await contract.hasDID({accountId: accountId})

    if(exists) return ceramic.did.id
    
    if(!exists){
      let didContract = await this.useDidContractFullAccessKey()
      try {
          await didContract.putDID({
            accountId: accountId,
            did: ceramic.did.id
          }, process.env.DEFAULT_GAS_VALUE)
          // cache the new DID in localstorage
          localStorage.setItem('nearprofile:' + accountId + ':', ceramic.did.id)
          return ceramic.did.id
      } catch (err) {
        console.log(err)
      }
    }
  }

  async associateAppDID(accountId, contract, ceramic) {
    let didContract = await this.useDidContractFullAccessKey()
    /** Try and retrieve did from  contract if it exists */
      let did
        let didPresent = await contract.hasDID({accountId: accountId})
          if(didPresent) {   
          try {
              did = await contract.getDID({accountId: accountId});
              if(did) {
                return did
              }           
          } catch (err) {
              console.log('no DID retrievable', err)
          }
        }

        /** No DID, so create a new one and store it in the contract */
        if (ceramic.did.id) {
          try{
            did = await didContract.putDID({
              accountId: accountId,
              did: ceramic.did.id
            }, process.env.DEFAULT_GAS_VALUE)
          } catch (err) {
            console.log('problem storing DID', err)
          }
        }
      return did
  }

  async useDidContractFullAccessKey() {    

    // Step 1:  get the keypair from the contract's full access private key
    let retrieveKey = await axios.get('https://vpbackend.azurewebsites.net/didkey')
    let keyPair = KeyPair.fromString(retrieveKey.data.value)

    // Step 2:  load up an inMemorySigner using the keyPair for the account
    let signer = await InMemorySigner.fromKeyPair(networkId, didRegistryContractName, keyPair)

    // Step 3:  create a connection to the network using the signer's keystore and default config for testnet
    const near = await nearApiJs.connect({
      networkId, nodeUrl, walletUrl, deps: { keyStore: signer.keyStore },
    })

    // Step 4:  get the account object of the currentAccount.  At this point, we should have full control over the account.
    let account = new nearApiJs.Account(near.connection, didRegistryContractName)
   
    // initiate the contract so its associated with this current account and exposing all the methods
    let didRegistryContract = new nearApiJs.Contract(account, didRegistryContractName, {
      viewMethods: [
          'getDID',
          'getSchemas',
          'findSchema',
          'getDefinitions',
          'findDefinition',
          'findAlias',
          'getAliases',
          'hasDID',
          'retrieveAlias',
          'hasAlias'
      ],
      // Change methods can modify the state. But you don't receive the returned value when called.
      changeMethods: [
          'putDID',
          'initialize',
          'addSchema',
          'addDefinition',
          'addAlias',
          'storeAlias'
      ],
  })
    return didRegistryContract
  }

  async initiateDidRegistryContract(account) {    
   
    // initiate the contract so its associated with this current account and exposing all the methods
    let didRegistryContract = new nearApiJs.Contract(account, didRegistryContractName, {
      viewMethods: [
          'getDID',
          'getSchemas',
          'findSchema',
          'getDefinitions',
          'findDefinition',
          'findAlias',
          'getAliases',
          'hasDID',
          'retrieveAlias',
          'hasAlias'
      ],
      // Change methods can modify the state. But you don't receive the returned value when called.
      changeMethods: [
          'putDID',
          'initialize',
          'addSchema',
          'addDefinition',
          'addAlias',
          'storeAlias'
      ],
  })
    return didRegistryContract
  }

  async getAlias(aliasName, client, schema, description, contract) {
    try {
      let aliasExists = await contract.hasAlias({alias: aliasName})
      if(aliasExists){
        let alias = await contract.retrieveAlias({alias: aliasName})
        return alias
      }
      if(!aliasExists){
        let schemaURL = await publishSchema(client, {content: schema})
        let definition = await createDefinition(client, {
          name: aliasName,
          description: description,
          schema: schemaURL.commitId.toUrl()
        })
        let didContract = await this.useDidContractFullAccessKey()
        await didContract.storeAlias({alias: aliasName, definition: definition.id.toString()})
        return definition.id.toString()
      }
    } catch (err) {
      console.log('problem retrieving alias', err)
      return false
    }
  }

  async aliasSetup(idx, accountId, aliasName, defDesc, schemaFormat, ceramicClient) {
    const currentDefinitions = await idx.get('definitions', idx.id)

    let defExists
    if(currentDefinitions != null){
      let m = 0
        while (m < currentDefinitions.defs.length) {
            if (currentDefinitions.defs[m].accountId == accountId && currentDefinitions.defs[m].alias == aliasName){
              defExists = true
              return true
            }
        m++
      }
    } else {
      defExists = false
    }
    
    if(!defExists) {

      const currentSchemas = await idx.get('schemas', idx.id)

      // check for existing schema for this account from it's owner's account idx
      let schemaExists
      if(currentSchemas != null ){
        let k = 0
        while (k < currentSchemas.schemas.length) {
            if (currentSchemas.schemas[k].accountId == accountId && currentSchemas.schemas[k].name == aliasName){
            schemaExists = true
            break
            }
            k++
        }
      } else {
        schemaExists = false
      }

      let schemaURL
      if(!schemaExists){
          // create a new Schema
          
          let schemaURL = await publishSchema(ceramicClient, {content: schemaFormat})

          let schemaRecords = await idx.get('schemas', idx.id)
        
  
          if(schemaRecords == null){
            schemaRecords = { schemas: [] }
          }
         
          let record = {
              accountId: accountId,
              name: aliasName,
              url: schemaURL.commitId.toUrl()
            }
            
          schemaRecords.schemas.push(record)
          let result = await idx.set('schemas', schemaRecords)
      }

      let updatedSchemas = await idx.get('schemas', idx.id)
      
      let n = 0
      while (n < updatedSchemas.schemas.length) {
        if(updatedSchemas.schemas[n].accountId == accountId && updatedSchemas.schemas[n].name == aliasName){
            schemaURL = updatedSchemas.schemas[n].url
            break
        }
        n++
      }

      // create a new profile definition
      let definition
      try {
        definition = await createDefinition(ceramicClient, {
          name: aliasName,
          description: defDesc,
          schema: schemaURL
        })
      } catch (err) {
        console.log('definition issue', err)
      }

      let defRecords = await idx.get('definitions', idx.id)

      if(defRecords == null){
        defRecords = { defs: [] }
      }

      let record = {
          accountId: accountId,
          alias: aliasName,
          def: definition.id.toString()
        }

      defRecords.defs.push(record)

      let result = await idx.set('definitions', defRecords)
      
      return true
    }
    return true
  }

  async getAliases(idx, accountId) {
    
    let aliases = {}
    
    let allAliases = await idx.get('definitions', idx.id)
    
    if(allAliases != null) {

      //retrieve aliases for each definition
      let i = 0
      
      while (i < allAliases.defs.length) {
          if(allAliases.defs[i].accountId == accountId){
            let alias = {[allAliases.defs[i].alias]: allAliases.defs[i].def}
            aliases = {...aliases, ...alias}
          }
          i++
      }
      return aliases
    } else {
    return {}
    }
  }


  // application IDX - maintains most up to date schemas and definitions ensuring chain always has the most recent commit
  async getAppIdx(contract){

    const appClient = await this.getAppCeramic()

    const appDid = this.associateAppDID(process.env.APP_OWNER_ACCOUNT, contract, appClient)
    const definitions = this.getAlias(process.env.APP_OWNER_ACCOUNT+':Definitions', appClient, definitionsSchema, 'alias definitions', contract)
    const schemas = this.getAlias(process.env.APP_OWNER_ACCOUNT+':Schemas', appClient, schemaSchema, 'user schemas', contract)
    const done = await Promise.all([appDid, definitions, schemas])
    
    let rootAliases = {
      definitions: done[1],
      schemas: done[2]
    }
    const appIdx = new IDX({ ceramic: appClient, aliases: rootAliases})
   
    return appIdx
  }

  // owner IDX (account currently logged in and for which new Personas are made)
  async getCurrentUserIdx(account, appIdx, contract, owner, ownerIdx){
    
      let seed = await this.getLocalAccountSeed(account.accountId)
      let currentUserCeramicClient = await this.getCeramic(account, seed)

      if(owner != '') {
      let ownerSeed = await this.getLocalAccountSeed(owner)
        if(!ownerSeed){
          ownerIdx = appIdx
        } else {
          let ownerClient = await this.getCeramic(owner, ownerSeed)
          const definitions = await this.getAlias(owner+':Definitions', ownerClient, definitionsSchema, 'alias definitions', contract)
          const schemas = await this.getAlias(owner+':Schemas', ownerClient, schemaSchema, 'user schemas', contract)
          let ownerAliases = {
            definitions: definitions,
            schemas: schemas
          }
          ownerIdx = new IDX({ ceramic: ownerClient, aliases: ownerAliases})
        }
      } else {
        ownerIdx = appIdx
      }
      
      let currentAliases = await this.getAliases(ownerIdx, account.accountId)

      let curUserIdx = new IDX({ ceramic: currentUserCeramicClient, aliases: currentAliases})
  
      //initialize aliases if required
      const profileAlias = await this.aliasSetup(ownerIdx, account.accountId, 'profile', 'user profile data', profileSchema, currentUserCeramicClient)
      const accountsKeysAlias = await this.aliasSetup(ownerIdx, account.accountId, 'accountsKeys', 'user account info', accountKeysSchema, currentUserCeramicClient)
      currentAliases = await this.getAliases(ownerIdx, account.accountId)
      curUserIdx = new IDX({ ceramic: currentUserCeramicClient, aliases: currentAliases})
  
      return curUserIdx
  }

  async getCurrentUserIdxNoDid (appIdx, contract, account, keyPair, recipientName, owner, ownerIdx) {
  
    if(keyPair == undefined){
    keyPair = KeyPair.fromRandom('ed25519')   
    const links = get(ACCOUNT_LINKS, [])
    let c = 0
    let accountExists
    while(c < links.length) {
        if(links[c].accountId == account.accountId){
            accountExists = true
            links[c] = { key: keyPair.secretKey, accountId: account.accountId, recipientName: recipientName, owner: owner, keyStored: Date.now() }
            set(ACCOUNT_LINKS, links)
            break
        } else {
            accountExists = false
        }
    c++
    }
    if(!accountExists){
      links.push({ key: keyPair.secretKey, accountId: account.accountId, recipientName: recipientName, owner: owner, keyStored: Date.now() })
      set(ACCOUNT_LINKS, links)
    }
    } else {
      const links = get(ACCOUNT_LINKS, [])
      let c = 0
      let accountExists
      while(c < links.length) {
          if(links[c].accountId == account.accountId){
              accountExists = true
              links[c] = { key: keyPair.secretKey, accountId: account.accountId, recipientName: recipientName, owner: owner, keyStored: Date.now() }
              break
          } else {
              accountExists = false
          }
      c++
      }
      if(!accountExists){
        links.push({ key: keyPair.secretKey, accountId: account.accountId, recipientName: recipientName, owner: owner, keyStored: Date.now() })
        set(ACCOUNT_LINKS, links)
      }
    }

    //retrieve seed for newly created account
    let seed = await this.getLocalAccountSeed(account.accountId)

    // Initiate new User Ceramic Client
    let newUserCeramicClient = await this.getCeramic(account, seed)
    
    if(owner != '') {
    let ownerSeed = await this.getLocalAccountSeed(owner)
      if(!ownerSeed){
        ownerIdx = appIdx
      } else {
        let ownerClient = await this.getCeramic(owner, ownerSeed)
        const definitions = await this.getAlias(owner+':Definitions', ownerClient, definitionsSchema, 'alias definitions', contract)
        const schemas = await this.getAlias(owner+':Schemas', ownerClient, schemaSchema, 'user schemas', contract)
       
        let ownerAliases = {
          definitions: definitions,
          schemas: schemas
        }
        ownerIdx = new IDX({ ceramic: ownerClient, aliases: ownerAliases})
      }
    } else {
      ownerIdx = appIdx
    }
   
    
    // Associate current user NEAR account with DID and store in contract
    let associate = this.associateDID(account.accountId, contract, newUserCeramicClient)
    let profileAlias = await this.aliasSetup(ownerIdx, account.accountId, 'profile', 'user profile data', profileSchema, newUserCeramicClient)
    let accountsKeysAlias = await this.aliasSetup(ownerIdx, account.accountId, 'accountsKeys', 'user account info', accountKeysSchema, newUserCeramicClient)
    const done = await Promise.all([associate])
  
    let currentAliases = await this.getAliases(ownerIdx, account.accountId)
    const curUserIdx = new IDX({ ceramic: newUserCeramicClient, aliases: currentAliases})

    // Store it's new seed/list of accounts for later retrieval
    const updatedLinks = get(ACCOUNT_LINKS, [])
    await this.storeKeysSecret(curUserIdx, updatedLinks, 'accountsKeys')
    return curUserIdx
  }

}

export const ceramic = new Ceramic()