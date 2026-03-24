type Props = {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
      {icon && <p className="text-4xl mb-3">{icon}</p>}
      <p className="text-gray-700 font-medium text-base mb-1">{title}</p>
      {description && <p className="text-gray-500 text-sm mb-4">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
