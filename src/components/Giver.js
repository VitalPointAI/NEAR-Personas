import React, { useEffect, useState } from 'react';
import { MemoryRouter as Router } from 'react-router';
import PersonaCard from '../components/PersonaCard/personaCard'


const forExample = `(for example: "bestie.near" or "squad.near")`
const baseUrl = window.location.href.substr(0, window.location.href.lastIndexOf('/'))
const getLink = (accountId, key, wallet) => `?accountId=${accountId}&key=${key}&from=${wallet.getAccountId()}`

// Material UI
import { makeStyles } from '@material-ui/core/styles'
import Grid from '@material-ui/core/Grid'
import Divider from '@material-ui/core/Divider'
import Typography from '@material-ui/core/Typography';

const useStyles = makeStyles((theme) => ({
    root: {
        flexGrow: 1,
        maxWidth: 640,
        margin: 'auto',
        marginTop: 50,
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

export const Giver = ({ state, update, dispatch }) => {

    const classes = useStyles();

    const {
        app, wallet, links, claimed, accountId
    } = state

    const [editPersonaClicked, setEditPersonaClicked] = useState(false)
    const [countOfClaims, setCountOfClaims] = useState()
    const [countOfLinks, setCountOfLinks] = useState()

    useEffect(
        () => {
  
        async function fetchData() {
            let i = 0
            let countClaim = 0
            while (i < state.claimed.length ){
                if(state.claimed[i].owner == state.accountId){
                    countClaim++
                }
                i++
            }
            setCountOfClaims(countClaim)

            let j = 0
            let countLinks = 0
            while (j < state.links.length ){
                if(state.links[j].owner == state.accountId){
                    countLinks++
                }
                j++
            }
            setCountOfLinks(countLinks)
          
        }
        
        fetchData()
            .then((res) => {
      
            })
        
    }, [countOfClaims, countOfLinks]
    )


    function handleEditPersonaClick(property){
        setEditPersonaClicked(property)
    }

    return (
        <Router>
        <>
        <Grid container alignItems="center" justify="space-evenly" spacing={2} style={{marginBottom: '20px'}}>
            {countOfLinks > 0 ? 
                (<> <Grid item xs={12} sm={12} md={12} lg={12} xl={12} >
                        <Typography variant="h5" style={{marginBottom: '20px'}}>Ready To Claim</Typography>
                    </Grid>
                    {links.filter(person => person.owner == accountId).map(({ key, accountId, recipientName = '', owner }) =>
                        <PersonaCard
                            key={key}
                            name={recipientName}
                            accountId={accountId}
                            owner={owner}
                            link={getLink(accountId, key, wallet)}
                            state={state}
                            handleEditPersonaClick={handleEditPersonaClick}
                            />
                
                    )}
                </>)
                : (<>
                    <Grid item xs={12} sm={12} md={12} lg={12} xl={12} >
                        <Typography variant="overline" style={{marginBottom: '20px'}}>No Personas Waiting to Be Claimed.</Typography>
                    </Grid>
                    <Grid item xs={12} sm={12} md={12} lg={12} xl={12} >
                        <Typography variant="overline" style={{marginBottom: '20px'}}>Select Create Persona from menu to make one.</Typography>
                    </Grid>
                    </>
                    )
            }
        </Grid>
        <Divider variant="middle" style={{marginBottom: '20px'}}/>
        <Grid container alignItems="center" justify="space-evenly" spacing={2}>
            { countOfClaims > 0 ? 
                (<>
                    <Grid item xs={12} sm={12} md={12} lg={12} xl={12} >
                        <Typography variant="h5" style={{marginBottom: '20px'}}>Claimed</Typography>
                    </Grid>
                {claimed.filter(person => person.owner == accountId).map(({ key, accountId, recipientName = '', owner }) =>
                    <PersonaCard
                        key={key}
                        name={recipientName}
                        accountId={accountId}
                        owner={owner}
                        link={''}
                        state={state}
                        handleEditPersonaClick={handleEditPersonaClick}
                    />              
                )}
            </>)
            : null
            } 
        </Grid>
    </>
    </Router>
    )
}