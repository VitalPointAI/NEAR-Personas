import React, { useState, useEffect, useContext } from 'react'
import { appStore, onAppMount } from '../../state/app';
import { get, set, del } from '../../utils/storage'
import { ceramic } from '../../utils/ceramic'
import { IDX } from '@ceramicstudio/idx'
import EditPersonaForm from '../EditPersona/editPersona'
import * as nearAPI from 'near-api-js'


// Material UI Components
import { makeStyles } from '@material-ui/core/styles'
import Card from '@material-ui/core/Card'
import CardContent from '@material-ui/core/CardContent'
import CardActions from '@material-ui/core/CardActions'
import Avatar from '@material-ui/core/Avatar'
import Typography from '@material-ui/core/Typography'
import Link from '@material-ui/core/Link'
import { red } from '@material-ui/core/colors'
import Button from '@material-ui/core/Button'
import { CardHeader, LinearProgress } from '@material-ui/core'

import { config } from '../../state/config'

export const {
    ACCOUNT_LINKS
} = config

const useStyles = makeStyles((theme) => ({
    pos: {
        marginTop: 0,
    },
    card: {
      marginTop: '10px',
      maxWidth: '200px'
    },
    avatar: {
      backgroundColor: red[500],
    },
  }));

export default function PersonaCard(props) {

  const { state, dispatch, update } = useContext(appStore);

     const [dataObj, setDataObj] = useState({})
     const [avatar, setAvatar] = useState()
     const [editPersonaClicked, setEditPersonaClicked] = useState(false)
     const [claimed, setClaimed] = useState(false)
     const [curUserIdx, setCurUserIdx] = useState()
     const [display, setDisplay] = useState(false)
     const [isUpdated, setIsUpdated] = useState(false)
     const [anchorEl, setAnchorEl] = useState(null);
     const [did, setDid] = useState()
     const [finished, setFinished] = useState()

    const classes = useStyles();

    const { 
      owner,
      name,
      accountId,
      link
   } = props

    useEffect(
      () => {

      async function fetchData() {
              if(owner == state.accountId){
                setDisplay(true)
              }
              setFinished(false)
              console.log('state', state)
              
              let currentAliases = {}
             
              let existingDid = await state.didRegistryContract.hasDID({accountId: accountId})
          
              if(existingDid){
                let thisDid
                try {
                  thisDid = await state.didRegistryContract.getDID({accountId: accountId})
           
                  setDid(thisDid)
                } catch (err) {
                  console.log('no did', err)
                }
            
             
                
                let demSeed = await ceramic.downloadSecret(state.appIdx, 'SeedsJWE', thisDid)
                if(!demSeed) {
                  demSeed = await ceramic.getLocalSeed(accountId)
                  await ceramic.storeSeedSecret(state.appIdx, demSeed, 'SeedsJWE', thisDid)
                }
               
                let thisAccount = new nearAPI.Account(state.near.connection, accountId)
                let demClient = await ceramic.getCeramic(thisAccount, demSeed)

                let definitions = await state.didRegistryContract.getDefinitions()
              
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
            
                try {
                    let allAliases = await state.didRegistryContract.getAliases()
                
                    //reconstruct aliases, get profile and accountKeys aliases, and set IDXs
                    let i = 0
                    let profileAlias
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
                
                let userIdx = new IDX({ ceramic: demClient, aliases: currentAliases})
                setCurUserIdx(userIdx)
              
                // synch local storage Account Links to what is stored on Ceramic for this user
                let allAccounts = await ceramic.downloadKeysSecret(userIdx, 'accountsKeys')

                const storageLinks = get(ACCOUNT_LINKS, [])

                if(allAccounts.length != storageLinks.length){
                    if(allAccounts.length < storageLinks.length){
                      await ceramic.storeKeysSecret(userIdx, storageLinks, 'accountsKeys', userIdx.id)
                    }
                    if(allAccounts.length > storageLinks.length){
                        set(ACCOUNT_LINKS, allAccounts)
                    }
                }

                let result = await userIdx.get('profile', userIdx.id)
              
                let i = 0
                while (i < state.claimed.length) {
                  if(state.claimed[i].accountId == accountId){
                    let claimed = state.claimed[i].claimed
                    setClaimed(claimed)
                    break
                  }
                  i++
                }

                let isUpdated
                let dataObj = {
                    accountId: accountId,
                    did: did,
                    date: result ? result.date : '',
                    avatar: result ? result.avatar : '',
                    shortBio: result ? result.shortBio : '',
                    name: result ? result.name : '',
                }
                setAvatar(dataObj.avatar)
              }
  
              return dataObj
            
            }
         
      
      
      fetchData()
          .then((res) => {
            setDataObj(res)
            setFinished(true)
          })
      
  }, [state.appIdx, avatar, isUpdated]
  )

  function handleUpdate(property){
    setIsUpdated(property)
  }

  const handleEditPersonaClick = () => {
    handleExpanded()
    handleEditPersonaClickState(true)
  }

  function handleEditPersonaClickState(property){
    setEditPersonaClicked(property)
  }

  function handleExpanded() {
    setAnchorEl(null)
  }
    

    return(
        <>
        {display ? (
          <Card className={classes.card}>
            <CardHeader
              title={dataObj.name}
              subheader={dataObj.date}
              avatar = {<Avatar variant="square" src={avatar} className={classes.square} />}
           />
              <CardContent>
                <Typography gutterBottom variant="h6" noWrap={true}>
                  {accountId}
                </Typography>
              </CardContent>
      
            {finished ? ( <CardActions>
          
              {!claimed ? (
                  <Link color="primary" href={link}>
                    Claim
                  </Link>
              ) : null }

              {claimed ? (
                <Button onClick={handleEditPersonaClick} >
                    Edit Persona
                </Button>
              ) : null }
           


              {editPersonaClicked ? <EditPersonaForm
                state={state}
                handleEditPersonaClickState={handleEditPersonaClickState}
                curUserIdx={curUserIdx}
                handleUpdate={handleUpdate}
                did={did}
                accountId={accountId}
                /> : null }

            </CardActions> ) : <LinearProgress />}
          </Card>
          ) : null }
        </>
       
    )
}