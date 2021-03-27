import CeramicClient from '@ceramicnetwork/http-client'
import * as nearApiJs from 'near-api-js'
import { IDX } from '@ceramicstudio/idx'
import { createDefinition, publishSchema } from '@ceramicstudio/idx-tools'
import { Ed25519Provider } from 'key-did-provider-ed25519'

// schemas
import { profileSchema } from '../schemas/profile'
import { accountKeysSchema } from '../schemas/accountKeys'
import { personaSeedsSchema } from '../schemas/personaSeeds'

const bip39 = require('bip39')

import { config } from '../state/config'

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


const getPermission = async (request) => {
  return request.payload.paths
}


class Ceramic {

  async storeSeedSecret(idx, payload, key, did) {
    let record = await idx.get(key, idx._ceramic.did.id)
    if(!record){
      record = { seeds: [] }
    }
   
    const secretData = { did, payload }
   
    let access = [idx._ceramic.did.id]
    if(did) access.push(did)
    const jwe = await idx._ceramic.did.createDagJWE(secretData, access)
  
    record.seeds.push(jwe)
  
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

  async getLocalSeed(accountId) {
    const secretKey = localStorage.getItem('nearprofile:seed:'+accountId)
    if (!secretKey) {
      return false
    }
    let seed = Buffer.from(secretKey.slice(0, 32))
    return seed
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
    const seed = Buffer.from(process.env.APP_SEED.slice(0, 32))
    const API_URL = 'https://ceramic-clay.3boxlabs.com'
    const ceramic = new CeramicClient(API_URL, {cacheDocCommits: true, docSyncEnabled: false, docSynchInterval: 30000})
    const provider = new Ed25519Provider(seed)
    await ceramic.setDIDProvider(provider)
    return ceramic
  }

  async associateDID(accountId, contract, ceramic) {
   
    /** Restore any cached did first */
    const cached = localStorage.getItem('nearprofile:' + accountId + ':')

    if (cached !== null) {
      /** return */
      return cached
      }

    // ensure it's registered in the contract, if not, put it back there
    let exists = await contract.hasDID({accountId: accountId})
    
    if(!exists){
      let didContract = await this.useDidContractFullAccessKey()
      try {
          await didContract.putDID({
            accountId: accountId,
            did: ceramic.did.id
          }, process.env.DEFAULT_GAS_VALUE)
      } catch (err) {
        console.log(err)
      }
    }
    
    /** Try and retrieve did from  contract if it exists */
    if (cached === null) {
      let did
        try {
            let didPresent = await contract.hasDID({accountId: accountId})
            if(didPresent) {   
              did = await contract.getDID({accountId: accountId})
              localStorage.setItem('nearprofile:' + accountId + ':', did)
              return did
            }
        } catch (err) {
            console.log('no DID retrievable', err)
        }

        /** No cached DID existed, so create a new one and store it in the contract */
        if (ceramic.did.id) {
          let didContract = await this.useDidContractFullAccessKey()
          try{
            did = await didContract.putDID({
              accountId: accountId,
              did: ceramic.did.id
            }, process.env.DEFAULT_GAS_VALUE)
            // cache the new DID in localstorage
            localStorage.setItem('nearprofile:' + accountId + ':', ceramic.did.id)
            return ceramic.did.id
          } catch (err) {
            console.log('problem storing DID', err)
          }
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
    let keyPair = KeyPair.fromString(process.env.DID_CONTRACT_PRIV_KEY)

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
          'hasDID'
      ],
      // Change methods can modify the state. But you don't receive the returned value when called.
      changeMethods: [
          'putDID',
          'initialize',
          'addSchema',
          'addDefinition',
          'addAlias'
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
          'hasDID'
      ],
      // Change methods can modify the state. But you don't receive the returned value when called.
      changeMethods: [
          'putDID',
          'initialize',
          'addSchema',
          'addDefinition',
          'addAlias'
      ],
  })
    return didRegistryContract
  }

  async schemaSetup(accountId, schemaName, defDesc, contract, ceramicClient, schemaFormat){
     //let doc = await ceramicClient.loadDocumentRecords('k2t6wyfsu4pg1p657eif0wdeav1r28f4u0jbjghtg18kt4esvzd40ka1cfb263')
     //console.log('doc', doc)
    // check for existing profile definition for this account
    const definitions = await contract.getDefinitions()
   
    let defExists
    let m = 0
    while (m < definitions.length) {
        let key = definitions[m].split(':')
        if (key[0] == accountId && key[1] == schemaName){
          defExists = true
          return true
        }
      m++
    }
    
    if(!defExists) {

      let didContract = await this.useDidContractFullAccessKey()

      const schemas = await contract.getSchemas()

      // check for existing schema for this account
      let schemaExists
      let k = 0
      while (k < schemas.length) {
          let key = schemas[k].split(':')
          if (key[0] == accountId && key[1] == schemaName){
          schemaExists = true
          break
          }
          k++
      }

      if(!schemaExists){
          // create a new Schema
          
          let schemaURL = await publishSchema(ceramicClient, {content: schemaFormat})
        
          try{
          let found = await didContract.findSchema({
            schema: accountId + ':' + schemaName + ':' + schemaURL.commitId.toUrl()
          })
          if(!found){
            await didContract.addSchema({
            schema: accountId + ':' + schemaName + ':' + schemaURL.commitId.toUrl()
            }, process.env.DEFAULT_GAS_VALUE)
          }
          } catch (err) {
            console.log('error adding schema', err)
          }
      }

     
      // get profile Schema url from didContract
      const updatedSchemas = await contract.getSchemas()
      let schemaURL
      let n = 0
      while (n < updatedSchemas.length) {
        let key = updatedSchemas[n].split(':')
        if(key[0] == accountId && key[1] == schemaName){
            schemaURL = key[2] + ':' + key[3]
            break
        }
        n++
      }

      // create a new profile definition
      let definition
      try {
        definition = await createDefinition(ceramicClient, {
          name: schemaName,
          description: defDesc,
          schema: schemaURL
        })
      } catch (err) {
        console.log('definition issue', err)
      }

      // record the new definition
      try{
          await didContract.addDefinition({
          def: accountId + ':' + schemaName + ':' + definition.id.toString()
          }, process.env.DEFAULT_GAS_VALUE)
      } catch (err) {
        console.log('error adding definition ', err)
      }

      // record the alias
      let recordAlias = schemaName +':'+ definition.id.toString()
      try {
        let anAlias = await contract.findAlias({alias: recordAlias})
        if(!anAlias) {
          
            await didContract.addAlias({
                alias: recordAlias
            }, process.env.DEFAULT_GAS_VALUE)
        }
      } catch (err) {
          console.log('problem recording alias', err)
      }
      
      return true
    }
    return true
  }

  async getAppAliases(contract) {
    let appAliases = {}
    try {
        let allAliases = await contract.getAliases()
    
        //reconstruct aliases and set IDXs
        let i = 0
        
        while (i < allAliases.length) {
            let key = allAliases[i].split(':')
            let alias = {[key[0]]: key[1]}
            appAliases = {...appAliases, ...alias}
            i++
        }
        return appAliases
    } catch (err) {
        console.log('error retrieving aliases', err)
    }
    return {}
  }

  async getAppIdx(contract){
    const appClient = await this.getAppCeramic()
    const appDid = this.associateAppDID(process.env.APP_OWNER_ACCOUNT, contract, appClient)
    const schemas = this.schemaSetup(process.env.APP_OWNER_ACCOUNT, 'SeedsJWE', 'encrypted dao seeds', contract, appClient, personaSeedsSchema)
    await Promise.all([appDid, schemas])
    const appAliases = await this.getAppAliases(contract)
    const appIdx = new IDX({ ceramic: appClient, aliases: appAliases})
    return appIdx
  }

  async getCurrentUserIdx(account, contract, appIdx, did){
   
    let seed = await this.getLocalSeed(account.accountId)
   
    if(!seed) {
      seed = await this.downloadSecret(appIdx, 'SeedsJWE', did)
    
    }
     
      let currentUserCeramicClient = await this.getCeramic(account, seed)
  
      //initialize aliases if required
    
      const schema1 = this.schemaSetup(account.accountId, 'profile', 'user profile data', contract, currentUserCeramicClient, profileSchema)
      const schema2 = this.schemaSetup(account.accountId, 'accountsKeys', 'user account info', contract, currentUserCeramicClient, accountKeysSchema)
      await Promise.all([schema1, schema2])
      
      let currentAliases = await this.getUsersAliases(account.accountId, contract)
      const curUserIdx = new IDX({ ceramic: currentUserCeramicClient, aliases: currentAliases})
  
      return curUserIdx
  }

  async getUsersAliases(accountId, contract) {

    let currentAliases = {}

    let definitions = await contract.getDefinitions()
 
    let o = 0
    let profileDef
    while(o < definitions.length) {
      let key = definitions[o].split(':')
      if(key[0] == accountId && key[1] == 'profile'){
        profileDef = key[2]
        break
      }
      o++
    }

    let k = 0
    let accountKeysDef
    while(k < definitions.length) {
      let key = definitions[k].split(':')
      if(key[0] == accountId && key[1] == 'accountsKeys'){
        accountKeysDef = key[2]
        break
      }
      k++
    }

    //reconstruct aliases, get profile and accountKeys aliases, and set IDXs
    try {
        let allAliases = await contract.getAliases()
        let i = 0
        let profileCount = 0
        let accountsKeysCount = 0
        while (i < allAliases.length) {
            let key = allAliases[i].split(':')
            let alias = {[key[0]]: key[1]}
            if (alias.profile == profileDef) {
              currentAliases = {...currentAliases, ...alias}
              profileCount++
            }
            if (alias.accountsKeys == accountKeysDef) {
              currentAliases = {...currentAliases, ...alias}
              accountsKeysCount++
            }
            if(profileCount == 1 && accountsKeysCount == 1){
              break
            }
            i++
        }
        return currentAliases
    } catch (err) {
        console.log('error retrieving aliases', err)
    }
    return {}
  }

  async getCurrentUserIdxNoDid (appIdx, contract, account, ceramicSeed) {
   
    if(ceramicSeed == undefined){
      const mnemonic = bip39.generateMnemonic()
      let seed = await bip39.mnemonicToSeed(mnemonic)
      ceramicSeed = Buffer.from(seed.slice(0, 32))
    }

    localStorage.setItem('nearprofile:seed:' + account.accountId, ceramicSeed.toString('base64'))

    // Initiate Current User Ceramic Client
    let currentUserCeramicClient = await this.getCeramic(account, ceramicSeed)

    // Store it's new seed for later retrieval
    await this.storeSeedSecret(appIdx, ceramicSeed, 'SeedsJWE', currentUserCeramicClient.did.id)
    
    // Associate current user NEAR account with 3ID and store in contract and cache in local storage
    await this.associateDID(account.accountId, contract, currentUserCeramicClient)
    await this.schemaSetup(account.accountId, 'profile', 'user profile data', contract, currentUserCeramicClient, profileSchema)
    await this.schemaSetup(account.accountId, 'accountsKeys', 'user account info', contract, currentUserCeramicClient, accountKeysSchema)
    
    let currentAliases = await this.getUsersAliases(account.accountId, contract)

    const curUserIdx = new IDX({ ceramic: currentUserCeramicClient, aliases: currentAliases})
      
    return curUserIdx
  }

}

export const ceramic = new Ceramic()