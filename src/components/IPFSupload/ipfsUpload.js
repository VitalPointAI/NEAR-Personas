import React, { useState } from 'react'
const ipfsAPI = require('ipfs-http-client')
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
    root: {
      
      '& > *': {
        margin: theme.spacing(1),
      },
    },
    square: {
     
    },
     logo: {
        maxWidth: '150px',
        border: '1px solid',
      width: theme.spacing(12),
    },
  }));

export default function FileUpload(props) {

    const[addedFileHash, setAddedFileHash] = useState('QmZsKcVEwj9mvGfA7w7wUS1f2fLqcfzqdCnEGtdq6MBR7P')

    const {
        handleFileHash
    } = props

    const classes = useStyles();

    const ipfsApi = ipfsAPI('https://ipfs.infura.io:5001')
  
    captureFile = (event) => {
        event.stopPropagation()
        event.preventDefault()
        const file = event.target.files[0]
        let reader = new window.FileReader()
        reader.onloadend = () => this.saveToIpfs(reader)
        reader.readAsArrayBuffer(file)
    }

    saveToIpfs = (reader) => {
        let ipfsId
        const buffer = Buffer.from(reader.result)
        ipfsApi.add(buffer)
        .then((response) => {
          console.log('respone', response)
        ipfsId = response.path
        setAddedFileHash(ipfsId)
        handleFileHash(ipfsId)
        }).catch((err) => {
        console.error(err)
        })
    }

  arrayBufferToString = (arrayBuffer) => {
    return String.fromCharCode.apply(null, new Uint16Array(arrayBuffer))
  }

  handleSubmit = (event) => {
    event.preventDefault()
  }


    return (
        <div>
        <form id="captureMedia" onSubmit={handleSubmit}>
            <input type="file" onChange={captureFile} />
        </form>
      </div>
    )
  }

