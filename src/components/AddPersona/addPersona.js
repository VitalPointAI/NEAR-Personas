import React, { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { makeStyles } from '@material-ui/core/styles'

import { nameSuffix } from '../../state/near'
import { qs } from '../../App'

// Material UI components
import Button from '@material-ui/core/Button'
import TextField from '@material-ui/core/TextField'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import LinearProgress from '@material-ui/core/LinearProgress'
import Divider from '@material-ui/core/Divider'
import InputAdornment from '@material-ui/core/InputAdornment'

const useStyles = makeStyles((theme) => ({
    root: {
      flexGrow: 1,
      margin: 'auto',
      maxWidth: 325,
      minWidth: 325,
    },
    card: {
      margin: 'auto',
    },
    progress: {
      width: '100%',
      '& > * + *': {
        marginTop: theme.spacing(2),
      },
    },
    actionsContainer: {
      marginBottom: theme.spacing(2),
    },
    resetContainer: {
      padding: theme.spacing(3),
    },
    large: {
        width: theme.spacing(7),
        height: theme.spacing(7),
        textAlign: 'center'
    },
    heading: {
      fontSize: 24,
      marginLeft: '10px'
    },
    }));

export default function AddPersonaForm(props) {
    const [open, setOpen] = useState(true)
    const [finished, setFinished] = useState(true)
    const [id, setId] = useState('')
    const [amount, setAmount] = useState('')

    const { register, handleSubmit, watch, errors, transform } = useForm()

    const {
       state,
       handleAddPersonaClick
    } = props
    
    const classes = useStyles()


    useEffect(() => {
        
    },[])

    const handleClose = () => {
        handleAddPersonaClick(false)
        setOpen(!open)
    }
    
        return (
            <div>
            <Dialog open={open} onClose={handleClose} aria-labelledby="form-dialog-title">
              <DialogTitle id="form-dialog-title">Create Persona</DialogTitle>
              <DialogContent>
                    <div>
                        <TextField
                            id="accountName"
                            placeholder=" "
                            autoFocus
                            margin="dense"
                            variant="outlined"
                            name="id"
                            label="Account Name"
                            minLength={state.app.accountTaken ? 999999 : 2}
                            maxLength={48}
                            pattern="^(([a-z\d]+[\-_])*[a-z\d]+$"
                            value={id}
                            inputRef={register({
                                required: true                           
                            })}
                            InputProps={{
                                endAdornment: <><InputAdornment position="end">{nameSuffix}</InputAdornment></>,
                            }}
                            onChange={(e) => {
                                const v = e.target.value.toLowerCase()
                                setId(v)
                                state.wallet.isAccountTaken(v)
                            }}
                        />
                    {errors.id && <p style={{color: 'red'}}>You must provide an account name.</p>}
                    <div class="invalid-feedback">
                        {state.app.accountTaken ? 'Account name is already taken' : '2-48 characters, no spaces, no symbols'}
                    </div>
                  </div>
                  
                  <div class="form-floating mb-3">
                        <input type="number" class="form-control" id="fundingAmount" placeholder=" " required 
                            min={0.1} step={0.00001}  value={amount} onChange={(e) => {
                                const x = e.target.value
                                setAmount(x)
                            }}
                        />
                        <label for="fundingAmount">Initial Deposit Ⓝ</label>
                        <div class="invalid-feedback">
                            Please enter an amount of NEAR {'>='} 0.1
                        </div>
                    </div>
                   
                  <div>
                    <TextField
                        id="personaName"
                        name="personaName"
                        placeholder=" "
                        label="Persona Name"
                        inputRef={register({
                            required: true,
                            minimum: 1,
                            maximum: 64           
                        })} 
                    />
                    {errors.personaName && <p style={{color: 'red'}}>Please enter a Persona name.</p>}
                  </div>
     
                </DialogContent>
              {!finished ? <LinearProgress className={classes.progress} style={{marginBottom: '25px' }}/> : (
              <DialogActions>
              <Button
                color="primary"
                onClick={() => state.wallet.fundAccount(amount.toString(), id, qs('#personaName').value, state.accountId)}>
                CREATE PERSONA
              </Button>
              
                <Button onClick={handleClose} color="primary">
                  Cancel
                </Button>
              </DialogActions>)}
              <Divider style={{marginBottom: 10}}/>
              
           
            </Dialog>
          </div>
        )
}