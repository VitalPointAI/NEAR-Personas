import React, { useState, useEffect } from 'react'
import EditPersonaForm from '../../components/EditPersona/editPersona'
import { makeStyles } from '@material-ui/core/styles'

// Material UI Components
import Avatar from '@material-ui/core/Avatar'
import Grid from '@material-ui/core/Grid'
import Typography from '@material-ui/core/Typography';
import Tooltip from '@material-ui/core/Tooltip';
import Zoom from '@material-ui/core/Zoom';
import InfoIcon from '@material-ui/icons/Info';

const useStyles = makeStyles((theme) => ({
    root: {
        flexGrow: 1,
        maxWidth: 300,
        margin: 'auto',
        marginTop: 50,
        minHeight: 550,
    },
    paper: {
        padding: theme.spacing(2),
        textAlign: 'center',
        color: theme.palette.text.secondary,
    },
    customCard: {
        maxWidth: 600,
        minWidth: 275,
        margin: 'auto',
        padding: 20
    },
    small: {
        width: theme.spacing(3),
        height: theme.spacing(3),
        float: 'right',
      },
    media: {
        height: 140,
      },
    button: {
        margin: theme.spacing(1),
      },
    }));

export default function Persona(props) {
    const [dataObj, setDataObj] = useState({})
    const [profileExists, setProfileExists] = useState(false)
    const [editPersonaClicked, setEditPersonaClicked] = useState(false)
    const [anchorEl, setAnchorEl] = useState(null);
    
    const [isUpdated, setIsUpdated] = useState(false)

    const {
        state,
        accountId,
        balance,
        avatar
    } = props


    useEffect(
        () => {
  
        async function fetchData() {
            if(state.links.length || state.claimed.length > 0){
                return true
            }
            let isUpdated
        }

        fetchData()
            .then((res) => {
             res ? setProfileExists(true) : null
            })
        
    }, [state.links, state.claimed, isUpdated]
    )

const classes = useStyles()


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

    return (
        <Grid container justify="space-between" alignItems="flex-start" spacing={1}>
            <Grid item xs={12} sm={4} md={4} lg={4} xl={4}>
                {profileExists ? (<><Typography variant="overline" display="block">All Your Personas: {state.links.length + state.claimed.length}</Typography>
                <Tooltip TransitionComponent={Zoom} title="This is the total number of personas you have created across all your accounts, not just this one.">
                    <InfoIcon fontSize="small" />
                </Tooltip></>) : (<><Typography variant="overline" display="block">All Your Personas: 0</Typography>
                    <Tooltip TransitionComponent={Zoom} title="This is the total number of personas you have created across all your accounts, not just this one.">
                        <InfoIcon fontSize="small" />
                    </Tooltip></>)}
            </Grid>
            <Grid item xs={12} sm={8} md={8} lg={8} xl={8}>
            <Typography variant="overline" display="block" onClick={handleEditPersonaClick} style={{float:'right', marginLeft:'10px'}}>{accountId}: {balance} Ⓝ</Typography><Avatar src={avatar} className={classes.small} onClick={handleEditPersonaClick}/><br></br>
            </Grid>
            {editPersonaClicked ? <EditPersonaForm
                state={state}
                handleEditPersonaClickState={handleEditPersonaClickState}
                curUserIdx={state.curUserIdx}
                handleUpdate={handleUpdate}
                did={state.did}
                accountId={accountId}
                /> : null }
        </Grid>
    )
}