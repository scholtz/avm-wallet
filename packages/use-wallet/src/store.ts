import algosdk from 'algosdk'
import { logger } from 'src/logger'
import { NetworkId, isValidNetworkId } from 'src/network'
import { WalletId, type WalletAccount } from 'src/wallets'
import type { Store } from '@tanstack/store'

export type WalletAVMState = {
  accounts: WalletAccount[]
  activeAccount: WalletAccount | null
}

export type WalletAVMStateMap = Partial<Record<WalletId, WalletAVMState>>

export interface AVMState {
  avmWallet: boolean
  wallets: WalletAVMStateMap
  avmActiveWallet: WalletId | null
  activeNetwork: NetworkId
  algodClient: algosdk.Algodv2
}

export const defaultAVMState: AVMState = {
  avmWallet: true,
  wallets: {},
  avmActiveWallet: null,
  activeNetwork: NetworkId.TESTNET,
  algodClient: new algosdk.Algodv2('', 'https://testnet-api.4160.nodely.dev/')
}

export const LOCAL_STORAGE_KEY = 'avm-wallet:v3'

// AVMState mutations

export function addWallet(
  store: Store<AVMState>,
  { walletId, wallet }: { walletId: WalletId; wallet: WalletAVMState }
) {
  store.setState((state) => {
    const updatedWallets = {
      ...state.wallets,
      [walletId]: {
        accounts: wallet.accounts.map((account) => ({ ...account })),
        activeAccount: wallet.activeAccount ? { ...wallet.activeAccount } : null
      }
    }

    return {
      ...state,
      wallets: updatedWallets,
      avmActiveWallet: walletId
    }
  })
}

export function removeWallet(store: Store<AVMState>, { walletId }: { walletId: WalletId }) {
  store.setState((state) => {
    const updatedWallets = { ...state.wallets }
    delete updatedWallets[walletId]

    return {
      ...state,
      wallets: updatedWallets,
      avmActiveWallet: state.avmActiveWallet === walletId ? null : state.avmActiveWallet
    }
  })
}

export function setActiveWallet(store: Store<AVMState>, { walletId }: { walletId: WalletId | null }) {
  store.setState((state) => ({
    ...state,
    avmActiveWallet: walletId
  }))
}

export function setActiveAccount(
  store: Store<AVMState>,
  { walletId, address }: { walletId: WalletId; address: string }
) {
  store.setState((state) => {
    const wallet = state.wallets[walletId]
    if (!wallet) {
      logger.warn(`Wallet with id "${walletId}" not found`)
      return state
    }

    const newActiveAccount = wallet.accounts.find((a) => a.address === address)
    if (!newActiveAccount) {
      logger.warn(`Account with address ${address} not found in wallet "${walletId}"`)
      return state
    }

    const updatedWallet = {
      ...wallet,
      accounts: wallet.accounts.map((account) => ({ ...account })),
      activeAccount: { ...newActiveAccount }
    }

    const updatedWallets = {
      ...state.wallets,
      [walletId]: updatedWallet
    }

    return {
      ...state,
      wallets: updatedWallets
    }
  })
}

export function setAccounts(
  store: Store<AVMState>,
  { walletId, accounts }: { walletId: WalletId; accounts: WalletAccount[] }
) {
  store.setState((state) => {
    const wallet = state.wallets[walletId]
    if (!wallet) {
      logger.warn(`Wallet with id "${walletId}" not found`)
      return state
    }

    const newAccounts = accounts.map((account) => ({ ...account }))

    const isActiveAccountConnected = newAccounts.some(
      (account) => account.address === wallet.activeAccount?.address
    )

    const newActiveAccount = isActiveAccountConnected
      ? { ...wallet.activeAccount! }
      : newAccounts[0] || null

    const updatedWallet = {
      ...wallet,
      accounts: newAccounts,
      activeAccount: newActiveAccount
    }

    const updatedWallets = {
      ...state.wallets,
      [walletId]: updatedWallet
    }

    return {
      ...state,
      wallets: updatedWallets
    }
  })
}

export function setActiveNetwork(
  store: Store<AVMState>,
  { networkId, algodClient }: { networkId: NetworkId; algodClient: algosdk.Algodv2 }
) {
  store.setState((state) => ({
    ...state,
    activeNetwork: networkId,
    algodClient
  }))
}

// Type guards

export function isValidWalletId(walletId: any): walletId is WalletId {
  return Object.values(WalletId).includes(walletId)
}

export function isValidWalletAccount(account: any): account is WalletAccount {
  return (
    typeof account === 'object' &&
    account !== null &&
    typeof account.name === 'string' &&
    typeof account.address === 'string'
  )
}

export function isValidWalletAVMState(wallet: any): wallet is WalletAVMState {
  return (
    typeof wallet === 'object' &&
    wallet !== null &&
    Array.isArray(wallet.accounts) &&
    wallet.accounts.every(isValidWalletAccount) &&
    (wallet.activeAccount === null || isValidWalletAccount(wallet.activeAccount))
  )
}

export function isValidAVMState(state: any): state is AVMState {
  if (!state || typeof state !== 'object') return false
  if (typeof state.wallets !== 'object') return false
  for (const [walletId, wallet] of Object.entries(state.wallets)) {
    if (!isValidWalletId(walletId) || !isValidWalletAVMState(wallet)) return false
  }
  if (state.avmActiveWallet !== null && !isValidWalletId(state.avmActiveWallet)) return false
  if (!isValidNetworkId(state.activeNetwork)) return false

  return true
}
