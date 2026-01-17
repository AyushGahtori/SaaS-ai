interface Props {
    children: React.ReactNode;
}

const Layout = ({ children }: Props) => {
    return (
        //Main container: full viewport height, centered flex layout with responsive padding
        <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10"> 
            {/* Form wrapper: responsive width with max constraints (mobile = shrink to desktop = expand) */}
            <div className="w-full max-w-sm md:max-w-3xl">
                {children}
            </div>    
        </div>
    );
}

export default Layout;