import React, { useEffect, useState, useContext } from 'react';
import { keyRotation, walletUrl, SEED_PHRASE_LOCAL_COPY } from '../state/near';
import { appStore, onAppMount } from '../state/app';

import { makeStyles } from '@material-ui/core/styles';

// Material UI Components
import Button from '@material-ui/core/Button'
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import Grid from '@material-ui/core/Grid'
import Typography from '@material-ui/core/Typography';
import { red } from '@material-ui/core/colors';
import Divider from '@material-ui/core/Divider'

const useStyles = makeStyles((theme) => ({
    root: {
      maxWidth: '95%',
      margin: 'auto'
    },
    media: {
      height: 0,
      paddingTop: '56.25%', // 16:9
    },
    expand: {
      transform: 'rotate(0deg)',
      marginLeft: 'auto',
      transition: theme.transitions.create('transform', {
        duration: theme.transitions.duration.shortest,
      }),
    },
    expandOpen: {
      transform: 'rotate(180deg)',
    },
    avatar: {
      backgroundColor: red[500],
    },
  }));

export const Receiver = ({ dispatch }) => {
    const { state, update } = useContext(appStore);
    const { accountId, from, seedPhrase, message, link, keyExists } = state.accountData

    const classes = useStyles();

    const [claiming, setClaiming] = useState(false)
    const [success, setSuccess] = useState(0)
    const [seedHidden, setSeedHidden] = useState(true)

    useEffect(() => {
       
    }, [])


    if (claiming) {
        return (
            <Card className={classes.root}>
                <CardHeader
                    title="DO NOT CLOSE OR REFRESH THIS PAGE"
                    subheader="Claiming your persona..."
                />
                <CardContent>
                    
                </CardContent>
            </Card> 
        )
    }

    if (!keyExists || success === 1) {
        return (<>
            <Grid container spacing={1}>
                <Grid item xs={12} sm={12} md={12} lg={12} xl={12} >
                    <Card className={classes.root}>
                    <CardHeader
                        title="Congratulations!"
                    />
                    <CardContent>
                        <Typography variant="h5" gutterBottom style={{marginBottom:'20px'}}>{accountId} is ready to go.</Typography>
                        <Divider variant="middle" />
                        <a href={'/'}><Button>Go To Personas</Button></a>
                    </CardContent>
                    </Card> 
                </Grid>
            </Grid>
        </>
        )
    }

    return (<>
        <Grid container spacing={1}>
            <Grid item xs={12} sm={12} md={12} lg={12} xl={12} >
            <Card className={classes.root}>
            <CardHeader
                title="Your new NEAR Persona is almost ready!"
                subheader={`${from} created this persona with the account name:`}
            />
            <CardContent>
                <Typography variant="h5" gutterBottom style={{marginBottom:'20px'}}>{accountId}</Typography>
                <Divider variant="middle" />
                <Typography variant="h5" gutterBottom >IMPORTANT!</Typography>
                <Typography variant="body1" gutterBottom>Your seed phrase is like an account password. 
                We <b>do not store it for you and can't recover it</b>.  If you lose it, 
                you can not access the account.</Typography>
                <Typography variant="body1">It's a good idea to write it down and store it somewhere safe (offline) and <b>do not share it with anyone.</b></Typography>
            </CardContent>
            </Card> 
            </Grid>
           
            <Grid item xs={12} sm={12} md={12} lg={12} xl={12} >
                {seedHidden && <Button color="primary" style={{marginBottom: '10px'}} onClick={() => {
                    setSeedHidden(!seedHidden)
                }}>
                    REVEAL MY SECRET SEED PHRASE
                </Button>}
                <div class="form-floating mb-3" align="center">
                    <textarea readonly class="form-control" id="seedPhrase" value={seedHidden ? `************` : seedPhrase} />
                </div>
                {!seedHidden && <>
                    <Button color="primary" onClick={async () => {
                        setClaiming(true)
                        try {
                            await dispatch(keyRotation())
                            setSuccess(1)
                        } catch (e) {
                            if (e.message.indexOf('Can not sign transactions') > -1) {
                                alert('It looks like the account has already been claimed!')
                                setSuccess(1)
                            } else {
                                alert('There was an error claiming your account. Please try again.')
                                console.error(e)
                            }
                        }
                        setClaiming(false)
                    }}>
                        I Wrote It Down! CLAIM MY ACCOUNT NOW!
                </Button>
                </>}
            </Grid>
        </Grid>
    </>
    )
}