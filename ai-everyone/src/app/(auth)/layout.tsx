interface Props {
    children: React.ReactNode;
}

const Layout = ({ children }: Props) => {
    return (
        <div className="dark min-h-screen w-full bg-[var(--surface-0)] text-foreground">
            {children}
        </div>
    );
}

export default Layout;
