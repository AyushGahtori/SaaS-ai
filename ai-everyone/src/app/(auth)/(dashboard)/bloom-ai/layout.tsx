interface BloomAiLayoutProps {
  children: React.ReactNode;
}

const BloomAiLayout = ({ children }: BloomAiLayoutProps) => {
  return <div className="h-full overflow-hidden">{children}</div>;
};

export default BloomAiLayout;
