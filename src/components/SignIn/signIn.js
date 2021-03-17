import React from 'react'
import { login } from '../../state/near'
import { makeStyles } from '@material-ui/core/styles'

// Material UI Components
import Button from '@material-ui/core/Button'
import Paper from '@material-ui/core/Paper'
import Card from '@material-ui/core/Card'
import CardMedia from '@material-ui/core/CardMedia'
import CardHeader from '@material-ui/core/CardHeader'
import CardContent from '@material-ui/core/CardContent'
import Grid from '@material-ui/core/Grid'
import Typography from '@material-ui/core/Typography';
import LockOpenTwoToneIcon from '@material-ui/icons/LockOpenTwoTone';

const useStyles = makeStyles((theme) => ({
    root: {
        flexGrow: 1,
        maxWidth: '95%',
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
        maxWidth: '95%',
        minWidth: 275,
        margin: 'auto',
        padding: 20
    },
    media: {
        height: 140,
      },
    button: {
        margin: theme.spacing(1),
      },
    }));

export default function SignIn() {

const classes = useStyles()

    return (
        <Grid container spacing={3}>
          <Grid item xs={12}>
          
                <div className={classes.root}>
                  <Card className={classes.customCard}>
                    <CardMedia
                        component="img"
                        image={require("../../img/near_logo.png")}
                        title="Near Logo"
                    />
                    <CardHeader title="Ready To Create a NEAR Persona?"></CardHeader>
                    <CardContent>
                    <Typography variant="body2" color="textPrimary" component="p" style={{marginBottom: 20}}>
                    To do so, you need to sign in with an existing NEAR account. The button below will sign you in using NEAR Wallet.</Typography>
                    <Typography variant="body2" color="textSecondary" component="p" style={{marginBottom: 20}}>
                    Go ahead and click the button below to get started:</Typography>
                    <Button
                      variant="contained"
                      color="primary"
                      className={classes.button}
                      startIcon={<LockOpenTwoToneIcon />}
                      onClick={login}
                    >Sign In</Button>
                    </CardContent>
                  </Card>
                </div>
         
          </Grid>
        </Grid>
    )
}