import * as nearAPI from 'near-api-js'
import { get, set, del } from '../utils/storage'
import { ceramic } from '../utils/ceramic'
import { profileSchema } from '../schemas/profile'
import { personaSeedsSchema } from '../schemas/personaSeeds'
import { accountKeysSchema } from '../schemas/accountKeys'
import { IDX } from '@ceramicstudio/idx'

import { config } from './config'

const bip39 = require('bip39')

export const {
    FUNDING_DATA, FUNDING_DATA_BACKUP, ACCOUNT_LINKS, GAS, SEED_PHRASE_LOCAL_COPY,
    networkId, nodeUrl, walletUrl, nameSuffix,
    contractName, didRegistryContractName
} = config

const {
    KeyPair,
    InMemorySigner,
    transactions: {
        addKey, deleteKey, fullAccessKey
    },
    utils: {
        PublicKey,
        format: {
            parseNearAmount, formatNearAmount
        }
    }
} = nearAPI

export const initNear = () => async ({ update, getState, dispatch }) => {
    let finished = false
    const near = await nearAPI.connect({
        networkId, nodeUrl, walletUrl, deps: { keyStore: new nearAPI.keyStores.BrowserLocalStorageKeyStore() },
    });

    const isAccountTaken = async (accountId) => {
        const account = new nearAPI.Account(near.connection, accountId);
        try {
            await account.state()
        } catch(e) {
            console.warn(e)
            if (/does not exist while viewing/.test(e.toString())) {
                return false
            }
        }
        return true
    }

    

    // resume wallet / contract flow
    const wallet = new nearAPI.WalletAccount(near);

    wallet.signIn = () => {
        wallet.requestSignIn(contractName, 'Blah Blah')
    }

    wallet.signedIn = wallet.isSignedIn()
    if (wallet.signedIn) {
        wallet.balance = formatNearAmount((await wallet.account().getAccountBalance()).available, 2)
    }

    const contract = await new nearAPI.Contract(wallet.account(), contractName, {
        changeMethods: ['send', 'create_account', 'create_account_and_claim'],
    })

    wallet.isAccountTaken = async (accountId) => {
        const accountTaken = await isAccountTaken(accountId + nameSuffix)
        update('app', { accountTaken, wasValidated: true })
    }

    wallet.fundAccount = async (amount, accountId, recipientName, owner) => {
        
        if (accountId.indexOf(nameSuffix) > -1 || accountId.indexOf('.') > -1) {
            alert(nameSuffix + ' is added automatically and no "." is allowed. Please remove and try again.')
            return update('app.wasValidated', true)
        }
        accountId = accountId + nameSuffix
        if (parseFloat(amount, 10) < 0.1 || accountId.length < 2 || accountId.length > 48) {
            return update('app.wasValidated', true)
        }
        const keyPair = KeyPair.fromRandom('ed25519')

        let state = getState()
      
        let allAccounts = await ceramic.downloadKeysSecret(state.curUserIdx, 'accountsKeys')
        
        const storageLinks = get(ACCOUNT_LINKS, [])
     
        if(allAccounts.length != storageLinks.length){
            if(allAccounts.length < storageLinks.length){
                await ceramic.storeKeysSecret(state.curUserIdx, storageLinks, 'accountsKeys')
            }
            if(allAccounts.length > storageLinks.length){
                set(ACCOUNT_LINKS, allAccounts)
            }
        }

        const links = get(ACCOUNT_LINKS, [])
        links.push({ key: keyPair.secretKey, accountId, recipientName, owner, keyStored: Date.now() })
        await ceramic.storeKeysSecret(state.curUserIdx, links, 'accountsKeys')
        set(ACCOUNT_LINKS, links)

        // set(FUNDING_DATA, { key: keyPair.secretKey, accountId, recipientName, amount, funder_account_id: wallet.getAccountId() })
       
        await contract.create_account({ new_account_id: accountId, new_public_key: keyPair.publicKey.toString() }, GAS, parseNearAmount(amount))
    }

    // ********* Initiate Dids Registry Contract ************
   
    const accountId = wallet.account().accountId
    
    const account = new nearAPI.Account(near.connection, accountId);
   
    const didRegistryContract = new nearAPI.Contract(account, didRegistryContractName, {
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

     // ******** IDX Initialization *********

    //Set App Ceramic Client
    let appSeed = Buffer.from(process.env.APP_SEED.slice(0, 32))
    let appClient = await ceramic.getAppCeramic(appSeed)
    
    let appDID = await ceramic.associateAppDID('vitalpointai.testnet', didRegistryContract, appClient)
   
    // create app vault and definition if it doesn't exist
    await ceramic.schemaSetup('vitalpointai.testnet', 'SeedsJWE', 'encrypted dao seeds', didRegistryContract, appClient, personaSeedsSchema)

    let appAliases = {}
    try {
        let allAliases = await didRegistryContract.getAliases()
    
        //reconstruct aliases and set IDXs
        let i = 0
        
        while (i < allAliases.length) {
            let key = allAliases[i].split(':')
            let alias = {[key[0]]: key[1]}
            appAliases = {...appAliases, ...alias}
            i++
        }
              
    } catch (err) {
        console.log('error retrieving aliases', err)
    }

    let appIdx = new IDX({ ceramic: appClient, aliases: appAliases})

    // Set Current User Ceramic Client
    
        let did
        let personaSeed
        let currentUserCeramicClient
        let currentAliases = {}
        let curUserIdx
        let curInfo
   
        if(account.accountId){
            let existingDid = await didRegistryContract.hasDID({accountId: account.accountId})
           
            if(existingDid){
                did = await didRegistryContract.getDID({
                    accountId: account.accountId
                })
        
                personaSeed = await ceramic.downloadSecret(appIdx, 'SeedsJWE', did)
            
                if(personaSeed) {
                    currentUserCeramicClient = await ceramic.getCeramic(account, personaSeed)
                    await ceramic.schemaSetup(account.accountId, 'profile', 'user profile data', didRegistryContract, currentUserCeramicClient, profileSchema)
                    await ceramic.schemaSetup(account.accountId, 'accountsKeys', 'user account info', didRegistryContract, currentUserCeramicClient, accountKeysSchema)
                    
                    // Retrieve all the definitions so we can cycle through them and find the right profile and account keys definitions for the current 
                    // logged in user.  We have create unique definitions for each user so we can create custom profiles in the future by user.
                    let definitions = await didRegistryContract.getDefinitions()
             
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
                        let allAliases = await didRegistryContract.getAliases()
                      
                        let i = 0
                        while (i < allAliases.length) {
                            let key = allAliases[i].split(':')
                            let alias = {[key[0]]: key[1]}
                            if (alias.profile == profileDef) {
                              currentAliases = {...currentAliases, ...alias}
                            }
                            if (alias.accountsKeys == accountKeysDef) {
                              currentAliases = {...currentAliases, ...alias}
                            }
                              i++
                        }
                
                    } catch (err) {
                        console.log('error retrieving aliases', err)
                    }

                    curUserIdx = new IDX({ ceramic: currentUserCeramicClient, aliases: currentAliases})
                                     
                    // Get Current User's Profile
                    curInfo = await curUserIdx.get('profile')
                 
                }
            }
            if(!existingDid){
              
                const account = new nearAPI.Account(near.connection, accountId);
   
                const mnemonic = bip39.generateMnemonic()
                let seed = await bip39.mnemonicToSeed(mnemonic)
              
                const ceramicSeed = Buffer.from(seed.slice(0, 32))
                localStorage.setItem('nearprofile:seed:'+accountId, ceramicSeed.toString('base64'))
                    
                const didContract = new nearAPI.Contract(account, didRegistryContractName, {
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

                //Set App Ceramic Client
                let appSeed = Buffer.from(process.env.APP_SEED.slice(0, 32))
                let appClient = await ceramic.getAppCeramic(appSeed)


                let appAliases = {}
                try {
                    let allAliases = await didContract.getAliases()
                
                    //reconstruct aliases and set IDXs
                    let i = 0
                    
                    while (i < allAliases.length) {
                        let key = allAliases[i].split(':')
                        let alias = {[key[0]]: key[1]}
                        appAliases = {...appAliases, ...alias}
                        i++
                    }
                    
                } catch (err) {
                    console.log('error retrieving aliases', err)
                }

                let appIdx = new IDX({ ceramic: appClient, aliases: appAliases})
                
               
                // Set Current User Ceramic Client
                currentUserCeramicClient = await ceramic.getCeramic(account, ceramicSeed)
            
            
                let upload = await ceramic.storeSeedSecret(appIdx, ceramicSeed, 'SeedsJWE', currentUserCeramicClient.did.id)
                

                // Associate current user NEAR account with 3ID and store in contract and cache in local storage
                await ceramic.associateDID(accountId, didContract, currentUserCeramicClient)
                await ceramic.schemaSetup(accountId, 'profile', 'user profile data', didContract, currentUserCeramicClient, profileSchema)
                await ceramic.schemaSetup(accountId, 'accountsKeys', 'user account info', didContract, currentUserCeramicClient, accountKeysSchema)
                
                // Retrieve all the definitions so we can cycle through them and find the right profile and account keys definitions for the current 
                    // logged in user.  We have create unique definitions for each user so we can create custom profiles in the future by user.
                    let definitions = await didContract.getDefinitions()
           
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
                        let allAliases = await didContract.getAliases()
                      
                        let i = 0
                        while (i < allAliases.length) {
                            let key = allAliases[i].split(':')
                            let alias = {[key[0]]: key[1]}
                            if (alias.profile == profileDef) {
                              currentAliases = {...currentAliases, ...alias}
                            }
                            if (alias.accountsKeys == accountKeysDef) {
                              currentAliases = {...currentAliases, ...alias}
                            }
                              i++
                        }
                
                    } catch (err) {
                        console.log('error retrieving aliases', err)
                    }

                curUserIdx = new IDX({ ceramic: currentUserCeramicClient, aliases: currentAliases})
                                 
                // Set Current User's Avatar
                curInfo = await curUserIdx.get('profile')
                
            }
        }
    finished = true

    // check localLinks, see if they're still valid

   
      
    let allAccounts = await ceramic.downloadKeysSecret(curUserIdx, 'accountsKeys')
    
    const storageLinks = get(ACCOUNT_LINKS, [])
 
    if(allAccounts.length != storageLinks.length){
        if(allAccounts.length < storageLinks.length){
            await ceramic.storeKeysSecret(curUserIdx, storageLinks, 'accountsKeys')
        }
        if(allAccounts.length > storageLinks.length){
            set(ACCOUNT_LINKS, allAccounts)
        }
    }

    

    const localLinks = get(ACCOUNT_LINKS, []).sort((a) => a.claimed ? 1 : -1)
    for (let i = 0; i < localLinks.length; i++) {
        const { key, accountId, keyStored = 0, claimed } = localLinks[i]
        const exists = await isAccountTaken(accountId)
        if (!exists) {
            localLinks.splice(i, 1)
            continue
        }
        if (!!claimed || Date.now() - keyStored < 5000) {
            continue
        }
        const keyExists = await hasKey(key, accountId, near)
        if (!keyExists) {
            localLinks[i].claimed = true
        }
    }
    set(ACCOUNT_LINKS, localLinks)
    await ceramic.storeKeysSecret(curUserIdx, localLinks, 'accountsKeys')

    const claimed = localLinks.filter(({claimed}) => !!claimed)
    const links = localLinks.filter(({claimed}) => !claimed)

    update('', { near, wallet, links, claimed, currentAliases, curUserIdx, curInfo, didRegistryContract, appIdx, appAliases, did, accountId, finished })
}

export async function login() {
    const near = await nearAPI.connect({
        networkId, nodeUrl, walletUrl, deps: { keyStore: new nearAPI.keyStores.BrowserLocalStorageKeyStore() },
    });
    const connection = new nearAPI.WalletConnection(near)
    connection.requestSignIn(contractName, 'Near Personas')
}

export async function logout() {
    const near = await nearAPI.connect({
        networkId, nodeUrl, walletUrl, deps: { keyStore: new nearAPI.keyStores.BrowserLocalStorageKeyStore() },
    });
    const connection = new nearAPI.WalletConnection(near)
    connection.signOut()
    window.location.replace(window.location.origin)
}

export const unclaimLink = (keyToFind) => async ({ update }) => {
    let links = get(ACCOUNT_LINKS, [])
    const link = links.find(({ key }) => key === keyToFind)
    if (!link) {
        alert('cannot find link')
        return
    }
    link.claimed = false
    set(ACCOUNT_LINKS, links)

    const claimed = links.filter(({claimed}) => claimed === true)
    links = links.filter(({claimed}) => !claimed)
    
    update('', { links, claimed })
}

export const keyRotation = () => async ({ update, getState, dispatch }) => {
    const state = getState()
 
    const { key, accountId, publicKey, seedPhrase } = state.accountData

    const keyPair = KeyPair.fromString(key)
    const signer = await InMemorySigner.fromKeyPair(networkId, accountId, keyPair)
    const near = await nearAPI.connect({
        networkId, nodeUrl, walletUrl, deps: { keyStore: signer.keyStore },
    });
    const account = new nearAPI.Account(near.connection, accountId);
    const accessKeys = await account.getAccessKeys()
    const ceramicSeed = Buffer.from(seedPhrase.slice(0, 32))
    localStorage.setItem('nearprofile:seed:'+accountId, Buffer.from(seedPhrase).toString('base64'))
          
    const didContract = new nearAPI.Contract(account, didRegistryContractName, {
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

    //Set App Ceramic Client
    let appSeed = Buffer.from(process.env.APP_SEED.slice(0, 32))
    let appClient = await ceramic.getAppCeramic(appSeed)


    let appAliases = {}
    try {
        let allAliases = await didContract.getAliases()
    
        //reconstruct aliases and set IDXs
        let i = 0
        
        while (i < allAliases.length) {
            let key = allAliases[i].split(':')
            let alias = {[key[0]]: key[1]}
            appAliases = {...appAliases, ...alias}
            i++
        }
        
    } catch (err) {
        console.log('error retrieving aliases', err)
    }

    let appIdx = new IDX({ ceramic: appClient, aliases: appAliases})
    
    let didExists = await didContract.hasDID({accountId: accountId})
    if(didExists){
        try {
            did = await didContract.getDID({
            accountId: accountId
            })
         
        } catch (err) {
            console.log('no did here either', err)
        }
    }
   
    if(!didExists){
         // Set Current User Ceramic Client
        const currentUserCeramicClient = await ceramic.getCeramic(account, ceramicSeed)
    
        await ceramic.storeSeedSecret(appIdx, ceramicSeed, 'SeedsJWE', currentUserCeramicClient.did.id)

        // Associate current user NEAR account with 3ID and store in contract and cache in local storage
        await ceramic.associateDID(accountId, didContract, currentUserCeramicClient)
        await ceramic.schemaSetup(accountId, 'profile', 'user profile data', didContract, currentUserCeramicClient, profileSchema)
        await ceramic.schemaSetup(accountId, 'accountsKeys', 'user account info', didContract, currentUserCeramicClient, accountKeysSchema)
                 
    }
    
    const actions = [
        deleteKey(PublicKey.from(accessKeys[0].public_key)),
        addKey(PublicKey.from(publicKey), fullAccessKey())
    ]

    set(SEED_PHRASE_LOCAL_COPY, seedPhrase)

    const result = await account.signAndSendTransaction(accountId, actions)

    fetch('https://hooks.zapier.com/hooks/catch/6370559/ocibjmr/', {
        method: 'POST',
        body: JSON.stringify({
            account_id: accountId,
            time_claimed: Date.now()
        })
    })
    
    return result
}

export const hasKey = async (key, accountId, near) => {
    const keyPair = KeyPair.fromString(key)
    const pubKeyStr = keyPair.publicKey.toString()

    if (!near) {
        const signer = await InMemorySigner.fromKeyPair(networkId, accountId, keyPair)
        near = await nearAPI.connect({
            networkId, nodeUrl, walletUrl, deps: { keyStore: signer.keyStore },
        });
    }
    const account = new nearAPI.Account(near.connection, accountId);
    try {
        const accessKeys = await account.getAccessKeys()
        if (accessKeys.length > 0 && accessKeys.find(({ public_key }) => public_key === pubKeyStr)) {
            return true
        }
    } catch (e) {
        console.warn(e)
    }
    return false
}