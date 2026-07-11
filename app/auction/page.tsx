import AuctionClient from './AuctionClient';

export const metadata = {
  title: 'Private Reserve Auction - Midnight Network',
  description: 'Privacy-preserving reserve auction on Midnight Network via 1AM Wallet',
};

export default function AuctionPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <AuctionClient />
    </div>
  );
}
