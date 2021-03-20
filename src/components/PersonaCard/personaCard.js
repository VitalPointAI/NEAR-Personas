import React, { useState, useEffect, useContext } from 'react'
import { appStore, onAppMount } from '../../state/app';
import { ceramic } from '../../utils/ceramic'
import { IDX } from '@ceramicstudio/idx'
import EditPersonaForm from '../EditPersona/editPersona'


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
import { CardHeader } from '@material-ui/core'

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

              let did
              let currentAliases = {}
              console.log('accountid', accountId)
              let existingDid = await state.didRegistryContract.hasDID({accountId: accountId})
              if(existingDid){
              try {
                did = await state.didRegistryContract.getDID({accountId: accountId})
              } catch (err) {
                console.log('no did', err)
              }
           
              let demSeed = Buffer.from(localStorage.getItem('nearprofile:seed:'+accountId).slice(0, 32))
              if(!demSeed){
              demSeed = await ceramic.downloadSecret(state.appIdx, 'SeedsJWE', did)
              }
              

              let demClient = await ceramic.getCeramic(state.wallet.account(), demSeed)
  
              try {
                  let allAliases = await state.didRegistryContract.getAliases()
                  console.log('allAliases', allAliases)
              
                  //reconstruct aliases and set IDXs
                  let i = 0
                  
                  while (i < allAliases.length) {
                      let key = allAliases[i].split(':')
                      let alias = {[key[0]]: key[1]}
                      currentAliases = {...currentAliases, ...alias}
                      i++
                  }
          
              } catch (err) {
                  console.log('error retrieving aliases', err)
              }
              
              let userIdx = new IDX({ ceramic: demClient, aliases: currentAliases})
              console.log('useridx', userIdx)
              setCurUserIdx(userIdx)
              console.log('curuserIdx', curUserIdx)
                 

                let result = await userIdx.get('profile', userIdx.id)
                console.log('result', result)
            
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
                <Typography gutterBottom variant="h6">
                  {accountId}
                </Typography>
              </CardContent>
      

            <CardActions>
            
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
                /> : null }

            </CardActions>
          </Card>
          ) : null }
        </>
       
    )
}