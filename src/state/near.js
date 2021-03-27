import * as nearAPI from 'near-api-js'
import { get, set, del } from '../utils/storage'
import { ceramic } from '../utils/ceramic'

import { config } from './config'

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

        const links = get(ACCOUNT_LINKS, [])
        links.push({ key: keyPair.secretKey, accountId, recipientName, owner, keyStored: Date.now() })
        await ceramic.storeKeysSecret(state.curUserIdx, links, 'accountsKeys')
        set(ACCOUNT_LINKS, links)
       
        await contract.create_account({ new_account_id: accountId, new_public_key: keyPair.publicKey.toString() }, GAS, parseNearAmount(amount))
    }

    if(wallet.signedIn){

    // ********* Initiate Dids Registry Contract ************

    const accountId = wallet.account().accountId
    
    const account = new nearAPI.Account(near.connection, accountId)
   
    const didRegistryContract = await ceramic.initiateDidRegistryContract(account)

    // ******** IDX Initialization *********

    //Initiate App Ceramic Components
    
    const appIdx = await ceramic.getAppIdx(didRegistryContract)

    // Set Current User Ceramic Client

    let curUserIdx
    let existingDid = await didRegistryContract.hasDID({accountId: accountId})
    if(existingDid){
        let did = await didRegistryContract.getDID({
            accountId: accountId
        })
        curUserIdx = await ceramic.getCurrentUserIdx(account, didRegistryContract, appIdx, did)
        
    }
    if(!existingDid){
        curUserIdx = await ceramic.getCurrentUserIdxNoDid(appIdx, didRegistryContract, account)
    }
    
    // Set Current User's Info
    const curInfo = await curUserIdx.get('profile')    

    //synch local links with what's stored for the account in ceramic

   
      
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
        
        update('', { didRegistryContract, appIdx, accountId, curUserIdx, curInfo })
    }
    // check localLinks, see if they're still valid

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

    const claimed = localLinks.filter(({claimed}) => !!claimed)
    const links = localLinks.filter(({claimed}) => !claimed)
  
    finished = true

    update('', { near, wallet, links, claimed, finished })
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

    const didContract = await ceramic.initiateDidRegistryContract(account)

    const appIdx = await ceramic.getAppIdx(didContract)

    let didExists = await didContract.hasDID({accountId: accountId})
   
    if(!didExists){
        await ceramic.getCurrentUserIdxNoDid(appIdx, didContract, account, ceramicSeed)                 
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