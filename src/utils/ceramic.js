import CeramicClient from '@ceramicnetwork/http-client'
import ThreeIdProvider from '3id-did-provider'
import * as nearApiJs from 'near-api-js'
import { createDefinition, publishSchema } from '@ceramicstudio/idx-tools'

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
    let seed = Buffer.from(secretKey.slice(0, 32))
    return seed
  }

  async getCeramic(account, seed) {
    if(seed == undefined) {
      seed = await this.getSeed(account)
    }
    const API_URL = 'https://ceramic-clay.3boxlabs.com'
    const ceramic = new CeramicClient(API_URL, {docSyncEnabled: true})
    const threeId = await ThreeIdProvider.create({ceramic, getPermission, seed})
    const provider = threeId.getDidProvider()
    await ceramic.setDIDProvider(provider)
    return ceramic
  }

  async getAppCeramic(seed) {
    const API_URL = 'https://ceramic-clay.3boxlabs.com'
    const ceramic = new CeramicClient(API_URL, {docSyncEnabled: true})
    const threeId = await ThreeIdProvider.create({ceramic, getPermission, seed})
    const provider = threeId.getDidProvider()
    await ceramic.setDIDProvider(provider)
    return ceramic
  }

  async associateDID(accountId, contract, ceramic) {
    let didContract = await this.useDidContractFullAccessKey()
    /** Restore any cached did first */
    const cached = localStorage.getItem('nearprofile:' + accountId + ':')


    // ensure it's registered in the contract, if not, put it back there
    let exists = await contract.hasDID({accountId: accountId})
    
    if(!exists){
      try {
          await didContract.putDID({
            accountId: accountId,
            did: ceramic.did.id
          }, process.env.DEFAULT_GAS_VALUE)
      } catch (err) {
        console.log(err)
      }
    }
    
    if (cached !== null) {
    /** return */
    return cached
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

        /** No cached DID existed, so create a new one and store it in the contract */
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

  async schemaSetup(accountId, schemaName, defDesc, contract, ceramicClient, schemaFormat){

    let didContract = await this.useDidContractFullAccessKey()

    const definitions = await contract.getDefinitions()

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
  
    // check for existing profile definition for this account
    const updatedSchemas = await didContract.getSchemas()
   
    let defExists
    let m = 0
    while (m < definitions.length) {
        let key = definitions[m].split(':')
        if (key[0] == accountId && key[1] == schemaName){
      
        let recordAlias = schemaName +':'+ key[2]
      
        try {
          let anAlias = await didContract.findAlias({alias: recordAlias})
          if(!anAlias) {
              await didContract.addAlias({
                  alias: recordAlias
              }, process.env.DEFAULT_GAS_VALUE)
          }
        } catch (err) {
            console.log('problem recording alias', err)
        }
      
        defExists = true
        break
        }
        m++
    }

    if(!defExists){
        // get profile Schema url from didContract
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
        try{
          definition = await createDefinition(ceramicClient, {
          name: schemaName,
          description: defDesc,
          schema: schemaURL
        })
      } catch (err) {
        console.log('definition issue', err)
      }

      
        let recordAlias = schemaName +':'+ definition.id.toString()

        try {
          let anAlias = await didContract.findAlias({alias: recordAlias})
          if(!anAlias) {
              await didContract.addAlias({
                  alias: recordAlias
              }, process.env.DEFAULT_GAS_VALUE)
          }
        } catch (err) {
            console.log('problem recording alias', err)
        }

        try{
          let found = await didContract.findDefinition({
            def: accountId + ':' + schemaName + ':' + definition.id.toString()
          })
          if(!found){
            await didContract.addDefinition({
            def: accountId + ':' + schemaName + ':' + definition.id.toString()
            }, process.env.DEFAULT_GAS_VALUE)
          }
        } catch (err) {
          console.log('error adding definition ', err)
        }
    }
    
    return true
  }


}

export const ceramic = new Ceramic()