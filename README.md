# NEAR Personas

Extends Near Names to add profile (persona) support thanks to integration of NEAR accounts with Ceramic Network - specifically Ceramix IDX.

React frontend.

Uses IPFS for image storage.

## Setup

(localhost)
1. Clone
2. Run npm install
3. Download and run an IPFS node on desktop (or adjust the code
4. npm run build
5. npm run start

Configured to use a deployed contract on Testnet (dids.vitalpointai.testnet).  Included in the contract folder (written in AssemblyScript).

The contract is a decentralized identifier (DID) registry.  This enables any data from any persona built with this app to be called in to any other app just by knowing a user's NEAR account name.
