interface Props {
    children: React.ReactNode;
}

const Layout = ({ children }: Props) => {
    return (
        <div className="dark min-h-screen w-full bg-black">
            {children}
        </div>
    );
}

export default Layout;
