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

const imageName = require('../../img/default-profile.png') // default no-image avatar

export default function PersonaCard(props) {

  const { state, dispatch, update } = useContext(appStore);

    const [date, setDate] = useState('')
    const [name, setName] = useState('')
    const [avatar, setAvatar] = useState(imageName)
    const [shortBio, setShortBio] = useState('')
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
             
              // Set Card Persona Idx
             
             
              if(accountId){
                  let existingDid = await state.didRegistryContract.hasDID({accountId: accountId})
                  if(existingDid){
                      let thisDid = await state.didRegistryContract.getDID({
                          accountId: accountId
                      })
                      setDid(thisDid)
                     
                      let personaAccount = new nearAPI.Account(state.near.connection, accountId)
                      
                      let curPersonaIdx = await ceramic.getCurrentUserIdx(personaAccount, state.didRegistryContract, state.appIdx, thisDid)
                      setCurUserIdx(curPersonaIdx)
                      
                      let i = 0
                      while (i < state.claimed.length) {
                        if(state.claimed[i].accountId == accountId){
                          setClaimed(true)
                          break
                        }
                        i++
                      }
                  
                      let result = await curPersonaIdx.get('profile', curPersonaIdx.id)
                      
                      if(result){
                        result.date ? setDate(result.date) : setDate('')
                        result.avatar ? setAvatar(result.avatar) : setAvatar(imageName)
                        result.shortBio ? setShortBio(result.shortBio) : setShortBio('')
                        result.name ? setName(result.name) : setName('')
                        return true
                      }
                      return true
                  }
              }
            }

      fetchData()
          .then((res) => {
            setFinished(true)
          })
      
  }, [isUpdated]
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
              title={name}
              subheader={date}
              avatar = {<Avatar variant="square" src={avatar} className={classes.square} />}
           />
              <CardContent>
                <Typography gutterBottom variant="h6" noWrap={true}>
                  {accountId}
                </Typography>
              </CardContent>
      
            { finished ? ( <CardActions>
          
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
                curPersonaIdx={curUserIdx}
                handleUpdate={handleUpdate}
                did={did}
                accountId={accountId}
                /> : null }

            </CardActions> ) : <LinearProgress /> }
          </Card>) : null  }
         
        </>
       
    )
}