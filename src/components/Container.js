import React, { useState, useEffect, useContext } from 'react';
import { flexClass } from '../App'
import SignIn from '../components/SignIn/signIn'
import LogoutButton from '../components/LogoutButton/logoutButton'
import Persona from '../components/Persona/persona'
import AddPersonaForm from '../components/AddPersona/addPersona'
import EditPersonaForm from '../components/EditPersona/editPersona'

// Material UI
import { makeStyles } from '@material-ui/core/styles'
import Grid from '@material-ui/core/Grid'
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';
import Paper from '@material-ui/core/Paper';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import { CircularProgress } from '@material-ui/core';

const useStyles = makeStyles((theme) => ({
    root: {
        flexGrow: 1,
        maxWidth: 640,
        margin: 'auto',
        marginTop: 50,
        marginBottom: 50,
        minHeight: 550,
    },
    paper: {
        padding: theme.spacing(2),
        textAlign: 'center',
        color: theme.palette.text.secondary,
    },
    menuButton: {
      marginRight: theme.spacing(0),
    },
    title: {
      flexGrow: 1,
      textAlign: 'left'
    },
  }));

export const Container = ({ children, state }) => {

    const classes = useStyles();

    const [anchorEl, setAnchorEl] = useState(null);
    const [addPersonaClicked, setAddPersonaClicked] = useState(false)
   

    const {
        app, wallet, links, claimed, accountId, curInfo
    } = state

    useEffect(
        () => {
  
        async function fetchData() {
           
        }

        fetchData()
            .then((res) => {
             
            })
        
    }, []
    )

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    function handleAddPersonaClick(property){
        setAddPersonaClicked(property)
    }

    const addPersonaClick = () => {
        setAddPersonaClicked(true)
        handleClose()
    }

   
    return (
        <>
        <div class="background"></div>
        <div className={classes.root}>
        <Paper className={classes.paper}>
        <AppBar position="static" style={{marginBottom: '20px'}}>
        <Toolbar>
            <IconButton edge="start" className={classes.menuButton} color="inherit" aria-label="menu" onClick={handleClick}>
            <MenuIcon />
            </IconButton>
            <Menu
                id="simple-menu"
                anchorEl={anchorEl}
                keepMounted
                open={Boolean(anchorEl)}
                onClose={handleClose}
            >
                <MenuItem onClick={addPersonaClick}>Create Persona</MenuItem>
               
            </Menu>

            <Typography variant="h6" className={classes.title} >
            <a href="/" style={{color: 'white'}}>NEAR PERSONAS (TestNet)</a>
            </Typography>
            {wallet && wallet.signedIn ? <LogoutButton /> : null }
        </Toolbar>
        </AppBar>
        <Grid container spacing={1}>
            <Grid item xs={12} sm={12} md={12} lg={12} xl={12} >
               {wallet && wallet.signedIn ? <Persona state={state} accountId={wallet.getAccountId()} balance={wallet.balance} avatar={curInfo.avatar}/> : null}
            </Grid>
        </Grid>

        {addPersonaClicked ? <AddPersonaForm
            state={state}
            handleAddPersonaClick={handleAddPersonaClick}
            /> : null }

        <div class={flexClass}>
            {state.finished ? (
                <div class="container container-custom">
                {wallet && wallet.signedIn ? children : <SignIn/>}
                </div>
                ) : state.accountData ? (
                <div class="container container-custom">
                {children}
                </div>
                ) : <CircularProgress/> }
                
        </div>
        </Paper>
        { state.app.alert &&
            <div class="container-alert">
                <div class={flexClass + ' mt-0'}>
                    <div class="container container-custom mt-0">
                        <div class="alert alert-primary mt-0" role="alert">
                            {state.app.alert}
                        </div>
                    </div>
                </div>
            </div>
        }
        </div>
    </>
    )
}