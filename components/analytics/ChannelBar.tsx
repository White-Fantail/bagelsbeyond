type Props = {
  storePercent: number;
  uberPercent: number;
  doordashPercent: number;
  otherPercent: number;
};

export default function ChannelBar({
  storePercent,
  uberPercent,
  doordashPercent,
  otherPercent,
}: Props) {
  return (
    <div className="flex w-full h-3 rounded-full overflow-hidden gap-px">
      {storePercent > 0 && (
        <div
          className="bg-blue-500 h-full"
          style={{ width: `${storePercent}%` }}
          title={`Store ${storePercent.toFixed(1)}%`}
        />
      )}
      {uberPercent > 0 && (
        <div
          className="bg-green-500 h-full"
          style={{ width: `${uberPercent}%` }}
          title={`Uber Eats ${uberPercent.toFixed(1)}%`}
        />
      )}
      {doordashPercent > 0 && (
        <div
          className="bg-red-500 h-full"
          style={{ width: `${doordashPercent}%` }}
          title={`DoorDash ${doordashPercent.toFixed(1)}%`}
        />
      )}
      {otherPercent > 0 && (
        <div
          className="bg-gray-400 h-full"
          style={{ width: `${otherPercent}%` }}
          title={`Other ${otherPercent.toFixed(1)}%`}
        />
      )}
    </div>
  );
}
