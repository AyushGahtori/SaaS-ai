interface Props {
    children: React.ReactNode;
}

const Layout = ({ children }: Props) => {
    return (
        <div className="w-full h-screen">
            {children}
        </div>
    );
}

export default Layout;