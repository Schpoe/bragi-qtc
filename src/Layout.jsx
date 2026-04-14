import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LayoutDashboard, Users, FolderKanban, CalendarRange, Menu, X, Trash2, Shield, LogOut, Eye, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { isAdmin } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { bragiQTC } from "@/api/bragiQTCClient";
import ImpersonationBanner from "@/components/admin/ImpersonationBanner";
import ImpersonateUserDialog from "@/components/admin/ImpersonateUserDialog";
import logo from "@/bragi-qtc-new.png";

const navItems = [
  { name: "Overview", page: "Dashboard", icon: LayoutDashboard },
  { name: "Quarterly Planning", page: "QuarterlyPlanning", icon: CalendarRange },
  { name: "Teams", page: "Teams", icon: Users },
  { name: "Work Items", page: "WorkAreas", icon: FolderKanban },
  { name: "Work Item Types", page: "WorkAreaTypes", icon: FolderKanban, adminOnly: true },
  { name: "Profile", page: "UserProfile", icon: Users },
  { name: "User Management", page: "UserManagement", icon: Shield, adminOnly: true },
  { name: "Cleanup", page: "Cleanup", icon: Trash2, adminOnly: true },
];

export default function Layout({ children, currentPageName }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [impersonateDialogOpen, setImpersonateDialogOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebar-collapsed") === "true");
  const { user, logout } = useAuth();

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      localStorage.setItem("sidebar-collapsed", !prev);
      return !prev;
    });
  };
  
  const filteredNavItems = navItems.filter(item => 
    !item.adminOnly || isAdmin(user)
  );

  // Session timeout - 30 minutes of inactivity
  useEffect(() => {
    let timeout;
    
    const resetTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        logout();
      }, 30 * 60 * 1000); // 30 minutes
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetTimeout);
    });

    resetTimeout();

    return () => {
      clearTimeout(timeout);
      events.forEach(event => {
        document.removeEventListener(event, resetTimeout);
      });
    };
  }, []);

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-background flex">
      <ImpersonationBanner />
      {/* Desktop Sidebar */}
      <TooltipProvider delayDuration={200}>
      <aside className={cn(
        "hidden lg:flex flex-col border-r border-border bg-card fixed h-full z-30 transition-[width] duration-300 overflow-hidden",
        collapsed ? "w-14" : "w-64"
      )}>
        {/* Header */}
        <div className={cn("border-b border-border flex items-center justify-between", collapsed ? "p-3 flex-col gap-2" : "p-5")}>
          {collapsed ? (
            <img src={logo} alt="Bragi" className="h-7 w-auto" />
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <img src={logo} alt="Bragi" className="h-7 w-auto" />
                <h1 className="text-lg font-bold text-foreground tracking-tight">
                  Capacity<span className="text-primary">Planning</span>
                </h1>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Quarterly Capacity Planning</p>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" onClick={toggleCollapsed}>
                {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
          </Tooltip>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = currentPageName === item.page;
            const link = (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                  collapsed ? "justify-center px-0 py-2.5 w-full" : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!collapsed && item.name}
              </Link>
            );
            return collapsed ? (
              <Tooltip key={item.page}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.name}</TooltipContent>
              </Tooltip>
            ) : link;
          })}
        </nav>

        {/* Footer */}
        <div className={cn("border-t border-border space-y-1", collapsed ? "p-2" : "p-3")}>
          {!collapsed && (
            <div className="px-3 pb-2">
              <div className="text-xs text-muted-foreground">Logged in as</div>
              <div className="text-sm font-medium truncate">
                {user?.first_name && user?.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : user?.full_name || user?.email}
              </div>
              <div className="text-xs text-muted-foreground capitalize">{user?.role?.replace('_', ' ')}</div>
            </div>
          )}
          {isAdmin(user) && !user?._impersonating && (
            collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-full h-9 text-muted-foreground hover:text-foreground" onClick={() => setImpersonateDialogOpen(true)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Impersonate User</TooltipContent>
              </Tooltip>
            ) : (
              <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={() => setImpersonateDialogOpen(true)}>
                <Eye className="w-4 h-4 mr-3" />
                Impersonate User
              </Button>
            )
          )}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-full h-9 text-muted-foreground hover:text-foreground" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Logout</TooltipContent>
            </Tooltip>
          ) : (
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-3" />
              Logout
            </Button>
          )}
        </div>
      </aside>
      </TooltipProvider>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b border-border flex items-center px-4 z-40">
        <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2">
          <Menu className="w-5 h-5" />
        </button>
        <img src={logo} alt="Bragi" className="h-6 w-auto ml-2" />
        <h1 className="text-sm font-bold ml-2">
          Capacity<span className="text-primary">Planning</span>
        </h1>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full bg-card border-r border-border flex flex-col">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={logo} alt="Bragi" className="h-7 w-auto" />
                <h1 className="text-lg font-bold">
                  Capacity<span className="text-primary">Planning</span>
                </h1>
              </div>
              <button onClick={() => setMobileOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {filteredNavItems.map((item) => {
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-border space-y-3">
              <div className="px-3">
                <div className="text-xs text-muted-foreground">Logged in as</div>
                <div className="text-sm font-medium truncate">
                  {user?.first_name && user?.last_name 
                    ? `${user.first_name} ${user.last_name}` 
                    : user?.full_name || user?.email}
                </div>
                <div className="text-xs text-muted-foreground capitalize">{user?.role?.replace('_', ' ')}</div>
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start text-muted-foreground hover:text-foreground"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-3" />
                Logout
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className={cn(
        "flex-1 pt-14 lg:pt-0 transition-[margin] duration-300",
        collapsed ? "lg:ml-14" : "lg:ml-64",
        user?._impersonating && "pt-32 lg:pt-20"
      )}>
        <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>

      <ImpersonateUserDialog
        open={impersonateDialogOpen}
        onOpenChange={setImpersonateDialogOpen}
      />
    </div>
  );
}