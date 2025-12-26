import { useStore } from '@tanstack/solid-store'
import algosdk from 'algosdk'
import { JSX, createContext, createMemo, onMount, useContext } from 'solid-js'
import type {
  AlgodConfig,
  NetworkId,
  SignDataResponse,
  SignMetadata,
  WalletId,
  WalletManager,
  WalletState
} from 'avm-wallet'

export * from 'avm-wallet'

interface WalletProviderProps {
  manager: WalletManager
  children: JSX.Element
}

const WalletContext = createContext<() => WalletManager>()

export const WalletProvider = (props: WalletProviderProps): JSX.Element => {
  const store = () => props.manager

  onMount(async () => {
    try {
      await props.manager.resumeSessions()
    } catch (error) {
      console.error('Error resuming sessions:', error)
    }
  })

  return <WalletContext.Provider value={store}>{props.children}</WalletContext.Provider>
}

export const useWalletManager = (): WalletManager => {
  const manager = useContext(WalletContext)
  if (!manager) {
    throw new Error('useWalletManager must be used within a WalletProvider')
  }
  return manager()
}

export const useNetwork = () => {
  const manager = createMemo(() => useWalletManager())
  const activeNetwork = useStore(manager().store, (state) => state.activeNetwork)
  const activeNetworkConfig = () => {
    const store = useStore(manager().store)
    return store().networkConfig[activeNetwork()]
  }

  const setActiveNetwork = async (networkId: NetworkId | string): Promise<void> => {
    if (networkId === activeNetwork()) {
      return
    }

    if (!manager().networkConfig[networkId]) {
      throw new Error(`Network "${networkId}" not found in network configuration`)
    }

    console.info(`[Solid] Creating new Algodv2 client...`)

    const { algod } = manager().networkConfig[networkId]
    const { token = '', baseServer, port = '', headers = {} } = algod
    const newClient = new algosdk.Algodv2(token, baseServer, port, headers)

    await manager().setActiveNetwork(networkId)

    manager().store.setState((state) => ({
      ...state,
      activeNetwork: networkId,
      algodClient: newClient
    }))

    console.info(`[Solid] ✅ Active network set to ${networkId}.`)
  }

  const updateAlgodConfig = (networkId: string, config: Partial<AlgodConfig>): void => {
    manager().updateAlgodConfig(networkId, config)

    // If this is the active network, update the algodClient
    if (networkId === activeNetwork()) {
      console.info(`[Solid] Creating new Algodv2 client...`)
      const { algod } = manager().networkConfig[networkId]
      const { token = '', baseServer, port = '', headers = {} } = algod
      const newClient = new algosdk.Algodv2(token, baseServer, port, headers)

      manager().store.setState((state) => ({
        ...state,
        algodClient: newClient
      }))
    }
  }

  const resetNetworkConfig = (networkId: string): void => {
    manager().resetNetworkConfig(networkId)

    // If this is the active network, update the algodClient
    if (networkId === activeNetwork()) {
      console.info(`[Solid] Creating new Algodv2 client...`)
      const { algod } = manager().networkConfig[networkId]
      const { token = '', baseServer, port = '', headers = {} } = algod
      const newClient = new algosdk.Algodv2(token, baseServer, port, headers)

      manager().store.setState((state) => ({
        ...state,
        algodClient: newClient
      }))
    }
  }

  return {
    activeNetwork,
    networkConfig: () => manager().networkConfig,
    activeNetworkConfig,
    setActiveNetwork,
    updateAlgodConfig,
    resetNetworkConfig
  }
}

export const useWallet = () => {
  const manager = createMemo(() => useWalletManager())

  const managerStatus = useStore(manager().store, (state) => state.managerStatus)
  const isReady = createMemo(() => managerStatus() === 'ready')
  const algodClient = useStore(manager().store, (state) => state.algodClient)

  const walletStore = useStore(manager().store, (state) => state.wallets)
  const walletState = (walletId: WalletId): WalletState | null => walletStore()[walletId] || null
  const avmActiveWalletId = useStore(manager().store, (state) => state.avmActiveWallet)
  const avmActiveWallet = () => manager().getWallet(avmActiveWalletId() as WalletId) || null
  const avmActiveWalletState = () => walletState(avmActiveWalletId() as WalletId)
  const avmActiveWalletAccounts = () => avmActiveWalletState()?.accounts ?? null
  const avmActiveWalletAddresses = () =>
    avmActiveWalletAccounts()?.map((account) => account.address) ?? null
  const activeAccount = () => avmActiveWalletState()?.activeAccount ?? null
  const activeAddress = () => activeAccount()?.address ?? null
  const isWalletActive = (walletId: WalletId) => walletId === avmActiveWalletId()
  const isWalletConnected = (walletId: WalletId) =>
    !!walletState(walletId)?.accounts.length || false

  const signTransactions = <T extends algosdk.Transaction[] | Uint8Array[]>(
    txnGroup: T | T[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]> => {
    const wallet = avmActiveWallet()
    if (!wallet) {
      throw new Error('No active wallet')
    }
    return wallet.signTransactions(txnGroup, indexesToSign)
  }

  const transactionSigner = (
    txnGroup: algosdk.Transaction[],
    indexesToSign: number[]
  ): Promise<Uint8Array[]> => {
    const wallet = avmActiveWallet()
    if (!wallet) {
      throw new Error('No active wallet')
    }
    return wallet.transactionSigner(txnGroup, indexesToSign)
  }

  const signData = (data: string, metadata: SignMetadata): Promise<SignDataResponse> => {
    const wallet = avmActiveWallet()
    if (!wallet) {
      throw new Error('No active wallet')
    }
    return wallet.signData(data, metadata)
  }

  return {
    wallets: manager().wallets,
    isReady,
    algodClient,
    avmActiveWallet,
    avmActiveWalletAccounts,
    avmActiveWalletAddresses,
    avmActiveWalletState,
    activeAccount,
    activeAddress,
    avmActiveWalletId,
    isWalletActive,
    isWalletConnected,
    signData,
    signTransactions,
    transactionSigner,
    walletStore
  }
}
