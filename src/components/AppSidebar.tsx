import {
  LayoutDashboard, Users, UserCog, LogOut, Network, BarChart3, ScrollText
} from "lucide-react";

import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, isUnionLeader, hasPermission, highestLevel, profile } = useAuth();
  const location = useLocation();

  const mainItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Members", url: "/members", icon: Users, show: hasPermission('view_members') },
    { title: "Leadership", url: "/leadership", icon: UserCog, show: hasPermission('manage_leaders') || hasPermission('view_members') },
    { title: "Reports", url: "/reports", icon: BarChart3, show: hasPermission('view_members') },
  ];

  const hierarchyItems = [
    { title: "Hierarchy", url: "/hierarchy", icon: Network, show: isUnionLeader || !!highestLevel },
    { title: "Audit Logs", url: "/audit-logs", icon: ScrollText, show: isUnionLeader },
  ];

  const handleNavClick = () => {
    // Close mobile sidebar on navigation
    setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <img
            src="/PCM-logo.png"
            alt="PCM Logo"
            className="h-8 w-8 rounded-lg object-contain shrink-0"
          />
          {!collapsed && (
            <div className="min-w-0">
              <h2 className="font-display font-bold text-sm text-sidebar-foreground">TUCASA</h2>
              <p className="text-[10px] text-sidebar-foreground/60">Management System</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.filter(i => i.show !== false).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      onClick={handleNavClick}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Organization</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {hierarchyItems.filter(i => i.show !== false).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      onClick={handleNavClick}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!collapsed && profile && (
          <div className="mb-3 px-2">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{profile.full_name}</p>
          </div>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && "Sign Out"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
