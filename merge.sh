git checkout -b v3.7.0
git pull git@github.com:TxnLab/use-wallet.git v3.7.0 --no-rebase --strategy-option theirs  -X theirs
./rename.sh
pnpm install
pnpm build:packages
pnpm build:examples
pnpm publish