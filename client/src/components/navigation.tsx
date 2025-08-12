import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { HomeIcon, GamepadIcon, WalletIcon, UserIcon, MenuIcon, CoinsIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function Navigation() {
  const { user } = useAuth();
  const [location] = useLocation();

  const { data: balanceData } = useQuery({
    queryKey: ['/api/balance'],
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const navItems = [
    { href: "/", icon: HomeIcon, label: "Dashboard" },
    { href: "/games", icon: GamepadIcon, label: "Games" },
    { href: "/payment-topup", icon: WalletIcon, label: "Top Up" },
    { href: "/withdrawal", icon: CoinsIcon, label: "Withdraw" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="bg-surface/80 border-b border-surface-light sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center space-x-4">
              <div className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                🎮 GameHub Pro
              </div>
            </Link>
            
            <div className="hidden md:flex items-center space-x-6">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={`text-gray-300 hover:text-white transition-colors ${
                      isActive(item.href) ? 'text-primary' : ''
                    }`}
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </div>
            
            {/* User Profile */}
            <div className="flex items-center space-x-4">
              <div className="bg-surface rounded-lg px-3 py-2 flex items-center space-x-2">
                <CoinsIcon className="w-4 h-4 text-accent" />
                <span className="text-white font-semibold">
                  {balanceData?.balance || user?.balance || 0}
                </span>
                <span className="text-gray-400 text-sm">Points</span>
              </div>
              <img 
                src={user?.profileImageUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=100"} 
                alt="User Avatar" 
                className="w-10 h-10 rounded-full border-2 border-primary cursor-pointer hover:border-secondary transition-colors object-cover"
                onClick={handleLogout}
                title="Click to logout"
              />
              
              {/* Mobile menu button */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden text-gray-400 hover:text-white">
                    <MenuIcon className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="bg-surface border-surface-light">
                  <div className="flex flex-col space-y-4 mt-8">
                    {navItems.map((item) => (
                      <Link key={item.href} href={item.href}>
                        <Button
                          variant="ghost"
                          className={`w-full justify-start text-gray-300 hover:text-white transition-colors ${
                            isActive(item.href) ? 'text-primary bg-primary/10' : ''
                          }`}
                        >
                          <item.icon className="w-4 h-4 mr-2" />
                          {item.label}
                        </Button>
                      </Link>
                    ))}
                    <Button
                      onClick={handleLogout}
                      variant="outline"
                      className="w-full justify-start mt-8 text-gray-300 hover:text-white border-surface-light"
                    >
                      <UserIcon className="w-4 h-4 mr-2" />
                      Logout
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface/90 border-t border-surface-light p-4 md:hidden z-40 backdrop-blur-sm">
        <div className="flex justify-around">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                size="sm"
                className={`flex flex-col items-center text-gray-400 hover:text-white transition-colors ${
                  isActive(item.href) ? 'text-primary' : ''
                }`}
              >
                <item.icon className="w-5 h-5 mb-1" />
                <span className="text-xs">{item.label}</span>
              </Button>
            </Link>
          ))}
          <Button
            onClick={handleLogout}
            variant="ghost"
            size="sm"
            className="flex flex-col items-center text-gray-400 hover:text-white transition-colors"
          >
            <UserIcon className="w-5 h-5 mb-1" />
            <span className="text-xs">Logout</span>
          </Button>
        </div>
      </div>
    </>
  );
}
