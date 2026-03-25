interface Props {
    children: React.ReactNode;
}

const Layout = ({ children }: Props) => {
    return (
        <div className="w-full min-h-screen flex items-center justify-center dark bg-black px-4">
            <div className="w-full max-w-4xl">
                {children}
            </div>
        </div>
    );
}

export default Layout;