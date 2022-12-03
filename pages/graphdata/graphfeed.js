import { useState, useEffect, useContext } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { client, DefaultProfile, getPublications, searchProfiles, HasTxHashBeenIndexed } from '../../api'
import { AAVE_DEPOSIT }  from '../external/query.js';
import { createClient } from 'urql'
import { MainContext } from '../../context.js'
import { ethers } from 'ethers'
import BigNumber from 'bignumber.js'
import ABI from '../../abi.json'
import SCWAbi from '../../ABIs/SCW.json'
import { gql, useMutation } from '@apollo/client';

import { v4 as uuid } from 'uuid';
import { 
    CONTRACT_ADDRESS, 
    AAVE_V2_MATIC_SUBGRAPH, 
    ZERO_BYTES, 
    Collect_Module, 
    Reference_Module, 
    ReferenceModuleInitData, 
    POLYGONSCAN_MAINNET,
    ARWEAVE_URI,
    Smart_Contract_Wallet
} from '../constants';

export default function GraphFeed() {
  const [deposits, setAaveDeposits] = useState([])
  const [profiles, setProfiles] = useState([])
  const [searchString, setSearchString] = useState('')
  const { bundlrInstance, token, address, connect, login, router, userLensId } = useContext(MainContext)

  useEffect(() => {
    getAaveData()
  }, [])

  async function getAaveData() {
    try {
      const client = new createClient({
        url: AAVE_V2_MATIC_SUBGRAPH
      });
      const data = await client.query(AAVE_DEPOSIT, { user: address, limit: 1 }).toPromise()
      console.log('data: ', data.data.deposits[0]);
      setAaveDeposits(data.data.deposits);
    } catch(e) {
      console.log(e)
    }
  }

  async function uploadText(deposit) {   
    // const data = {
    //   "tx": `{${POLYGONSCAN_MAINNET}${deposit.id.split(":")[2]}}`,
    //   "user": `{${POLYGONSCAN_MAINNET}${deposit.user.id}}`,
    //   "amount": `${getAmount(deposit.amount, deposit.reserve.decimals)} + ' ' +${deposit.reserve.symbol}`,
    //   "Token": deposit.reserve.name,
    //   "Price": deposit.reserve.price
    // }

                // tx: `{${POLYGONSCAN_MAINNET}${deposit.id.split(":")[2]}}`,
                // user: `{${POLYGONSCAN_MAINNET}${deposit.user.id}}`,
                // amount: `${getAmount(deposit.amount, deposit.reserve.decimals)} + ' ' +${deposit.reserve.symbol}`,
                // Token: deposit.reserve.name,
                // Price: deposit.reserve.price
            
    const textOnly = 'TEXT_ONLY'

    const data = {
        version: "2.0.0",
        mainContentFocus: textOnly,
        metadata_id: uuid(),
        description: "Sunny",
        locale: "en-US",
        content: "Sunny2.",
        external_url: null,
        image: null,
        imageMimeType: null,
        name: "Name",
        animation_url: null,
        contentWarning: null,
        attributes: [
            // {    
            //     traitType: "tx",
            //     displayType: "string",
            //     value: "sunny"        
            // }
        ],
        // tags: ["using_api_examples"],
        appId: "DefiLens",
        createdOn: new Date(),
        media: [],
      }

    console.log('bundlrInstance: ', bundlrInstance);
    const tx = bundlrInstance.createTransaction(JSON.stringify(data))
    const size = tx.size
    const cost = await bundlrInstance.getPrice(size);
    await tx.sign()
    const id = tx.id
    const result = await tx.upload()
    console.log('${ARWEAVE_URI}${tx.id}: ', `${ARWEAVE_URI}${tx.id}`);
    console.log(`successfully posted on Arweave`);
    return `${ARWEAVE_URI}${tx.id}`;
  }

  async function uploadFile() {    
    let tx = await bundlrInstance.upload(file, { tags: [{ name: "Content-type", value: "image/png" }] } )
    console.log('tx: ', tx, `${ARWEAVE_URI}${tx.id}`)
    setURI(`${ARWEAVE_URI}${tx.id}`)
  }

  function getSigner() {
    const provider = new ethers.providers.Web3Provider(window.ethereum)
    return provider.getSigner();
  }

  async function postWithSCW(deposit) {
    const SmartContractWallet = new ethers.Contract(
        Smart_Contract_Wallet,
        SCWAbi,
        getSigner()
    );
  
    const uri = await uploadText(deposit)
    console.log(`arweave url`, uri);

    try {
        let LensInterface = new ethers.utils.Interface(ABI);
        const tx = await SmartContractWallet.execBatch(
            [CONTRACT_ADDRESS], 
            [
                LensInterface.encodeFunctionData(
                    "post", 
                    [
                        {
                            profileId: userLensId,
                            // contentURI: uri,
                            contentURI: "https://arweave.net/kd1_TezRuhFlxxchvA8Sfa0TVFjXUxRjy2d6-MjItmI",
                            collectModule: Collect_Module,
                            collectModuleInitData: ZERO_BYTES,
                            referenceModule: Reference_Module,
                            referenceModuleInitData: ReferenceModuleInitData
                        }
                    ]
                )
            ]
        );

    await tx.wait();
    console.log('tx.hash: ', tx.hash);

    const hasTxHashBeenIndexed = await client.query({
        query: HasTxHashBeenIndexed,
        variables: {request: {
            txHash: tx.hash
        }}
    })
    console.log('HasTxHashBeenIndexed: ', hasTxHashBeenIndexed);
    console.log(`successfully posted on lens`)
    } catch (err) {
      console.log('error: ', err)
    }
  }

  async function post(deposit) {
    const contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      ABI,
      getSigner()
    )

    const SmartContractWallet = new ethers.Contract(
        Smart_Contract_Wallet,
        SCWAbi,
        getSigner()
      )
  

    const uri = await uploadText(deposit)
    console.log(`arweave url`, uri);

    try {
      const tx = await contract.post({
        profileId: userLensId,
        contentURI: uri,
        collectModule: Collect_Module,
        collectModuleInitData: ZERO_BYTES,
        referenceModule: Reference_Module,
        referenceModuleInitData: ReferenceModuleInitData
      })

      await tx.wait()

      console.log('tx.hash: ', tx.hash);

        const hasTxHashBeenIndexed = await client.query({
            query: HasTxHashBeenIndexed,
            variables: {request: {
                txHash: tx.hash
            }}
        })
      console.log('HasTxHashBeenIndexed: ', hasTxHashBeenIndexed);

      console.log(`successfully posted on lens`)
    } catch (err) {
      console.log('error: ', err)
    }
  }

  async function changePageHome() {
    router.push('/', '/', { shallow: true })
  }

  async function changePageGraph() {
    router.push('/graphdata/graphfeed', '/graphdata/graphfeed', { shallow: true })
  }

  async function changePageProfile() {
    router.push('/profile/profile', '/profile/profile', { shallow: true })
  }

   function getAmount(amount, decimals) {
    return BigNumber(amount).dividedBy(BigNumber(10).pow(decimals)).toString();
  }


  return (
    <div style={{margin: '50px'}}>
        <div style={{marginBottom: '10px'}}>
        <ul>
        <li><div onClick={changePageHome}>Home</div></li>
          <li><div onClick={changePageGraph}>Graph Data</div></li>
          <li><div onClick={changePageProfile}>Profile</div></li>
          <li style={{"float":"right"}}> 
            {
            !address && <button onClick={connect}>Connect to Wallet</button>
            }
            {
              address && !token && (
                <div onClick={login}>
                  <button style={{margin: "1rem", color: "white", backgroundColor: "blue"}}>Login</button>
                </div>
              )
            }
            {
              address && token && <h2>Successfully signed in!</h2>
            }
          </li>
        </ul>
      </div>
        
        {/* <Link href={`/profile/upload`}>
          Upload Image To Arweave
        </Link> */}

        <hr></hr>

        <div>
          {
            deposits.map((deposit, index) => (
            <div class="card">
            {/* <img src="/w3images/jeans3.jpg" alt="Denim Jeans" style="width:100%"> */}
                <h3>
                    <a style={{color: "blue", textDecoration: "underline"}} href={`https://polygonscan.com/tx/${deposit.id.split(":")[2]}`} target="_blank">
                        View Tx on polygon
                    </a>
                </h3>
                <a style={{color: "blue", textDecoration: "underline"}} href={`https://polygonscan.com/tx/${deposit.user.id}`} target="_blank">
                    User Address
                </a>
                <p>{getAmount(deposit.amount, deposit.reserve.decimals)} {deposit.reserve.symbol}</p>
                <p>{deposit.reserve.name}</p>
                <p>{deposit.reserve.decimals}</p>
                <p>{deposit.reserve.price}</p>
                <button onClick={() => postWithSCW(deposit)}>Apply for Lens</button>
            </div>


            //   <Link href={`/profile/${deposit.id}`} key={index}>
            //     <a>
            //       <h3>{deposit.id}</h3>
            //       <p >{deposit.amount}</p>
            //       <p >{deposit.user.id}</p>
            //       <p >Reserves:</p>
            //       <p >{deposit.reserve.id}</p>
            //       <p >{deposit.reserve.symbol}</p>
            //       <p >{deposit.reserve.name}</p>
            //       <p >{deposit.reserve.decimals}</p>
            //       <p >{deposit.reserve.price}</p>
            //       <button onClick={post}>Apply for Lens</button>
            //       <hr></hr>
            //     </a>
            //   </Link>
            ))
          }
        </div>
    </div>
  )
}

const blankPhotoStyle = {
  width: '52px',
  height: '52px',
  backgroundColor: 'black',
}