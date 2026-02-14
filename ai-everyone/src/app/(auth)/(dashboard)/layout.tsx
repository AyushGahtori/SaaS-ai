import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/modules/dashboard/ui/components/dashboard-sidebar";

interface Props {
  children: React.ReactNode;
}

const Layout = ({ children }: Props) => {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <DashboardSidebar />

        <main className="flex-1 bg-black text-foreground">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Layout;
