import { DashboardShellClient } from "@/modules/dashboard/ui/components/dashboard-shell-client";

interface Props {
  children: React.ReactNode;
}

const Layout = ({ children }: Props) => {
  return <DashboardShellClient>{children}</DashboardShellClient>;
};

export default Layout;

