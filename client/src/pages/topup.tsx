import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import Navigation from "@/components/navigation";
import { CoinsIcon, CreditCardIcon, DollarSignIcon, CrownIcon } from "lucide-react";

interface TopUpPackage {
  id: string;
  name: string;
  price: number;
  points: number;
  bonus?: number;
  popular?: boolean;
  icon: React.ReactNode;
}

const packages: TopUpPackage[] = [
  {
    id: 'starter',
    name: 'Starter Pack',
    price: 50,
    points: 500,
    icon: <CoinsIcon className="w-8 h-8 text-primary" />,
  },
  {
    id: 'value',
    name: 'Value Pack',
    price: 100,
    points: 1100,
    bonus: 100,
    popular: true,
    icon: <DollarSignIcon className="w-8 h-8 text-accent" />,
  },
  {
    id: 'premium',
    name: 'Premium Pack',
    price: 200,
    points: 2500,
    bonus: 300,
    icon: <CrownIcon className="w-8 h-8 text-secondary" />,
  },
];

export default function TopUp() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: balanceData } = useQuery({
    queryKey: ['/api/balance'],
  });

  const topUpMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const response = await apiRequest('POST', '/api/topup', {
        package: packageId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Top-up Successful!",
        description: `${data.transaction.amount} points added to your balance.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Top-up Failed",
        description: error.message || "Failed to process payment",
        variant: "destructive",
      });
    },
  });

  const handlePurchase = (packageId: string) => {
    topUpMutation.mutate(packageId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark via-surface to-dark">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-white">Top Up Points 💳</h1>
          <p className="text-gray-400">Add more points to continue playing!</p>
        </div>

        {/* Current Balance */}
        <Card className="bg-surface/80 border-surface-light backdrop-blur-sm mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Current Balance</p>
                <p className="text-3xl font-bold text-accent">
                  {balanceData?.balance || 0} Points
                </p>
              </div>
              <CoinsIcon className="h-12 w-12 text-accent opacity-60" />
            </div>
          </CardContent>
        </Card>

        <div className="max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {packages.map((pkg) => (
              <Card key={pkg.id} className={`bg-surface/80 border-surface-light backdrop-blur-sm hover:border-primary transition-colors relative ${pkg.popular ? 'border-accent' : ''}`}>
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-accent text-white">
                      POPULAR
                    </Badge>
                  </div>
                )}
                <CardContent className="p-6 text-center">
                  <div className="bg-primary/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    {pkg.icon}
                  </div>
                  <CardTitle className="text-xl font-bold mb-2 text-white">{pkg.name}</CardTitle>
                  <p className="text-3xl font-bold text-primary mb-2">₹{pkg.price}</p>
                  <p className="text-gray-400 mb-2">{pkg.points} Points</p>
                  {pkg.bonus && (
                    <p className="text-xs text-accent mb-4">+{pkg.bonus} Bonus Points</p>
                  )}
                  <Button 
                    onClick={() => handlePurchase(pkg.id)}
                    disabled={topUpMutation.isPending}
                    className={`w-full font-semibold py-3 px-4 rounded-lg transition-opacity ${
                      pkg.popular 
                        ? 'bg-accent text-white hover:bg-accent/90' 
                        : pkg.id === 'premium'
                        ? 'bg-secondary text-white hover:bg-secondary/90'
                        : 'bg-primary text-white hover:bg-primary/90'
                    }`}
                  >
                    {topUpMutation.isPending ? 'Processing...' : 'Purchase'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Payment Methods */}
          <Card className="bg-surface/80 border-surface-light backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-white">Payment Methods</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center justify-center p-4 bg-surface-light rounded-lg">
                  <CreditCardIcon className="w-6 h-6 text-blue-500 mr-2" />
                  <span className="font-medium text-white">Visa</span>
                </div>
                <div className="flex items-center justify-center p-4 bg-surface-light rounded-lg">
                  <CreditCardIcon className="w-6 h-6 text-red-500 mr-2" />
                  <span className="font-medium text-white">Mastercard</span>
                </div>
                <div className="flex items-center justify-center p-4 bg-surface-light rounded-lg">
                  <div className="w-6 h-6 bg-blue-600 rounded mr-2"></div>
                  <span className="font-medium text-white">PayPal</span>
                </div>
                <div className="flex items-center justify-center p-4 bg-surface-light rounded-lg">
                  <div className="w-6 h-6 bg-green-500 rounded mr-2"></div>
                  <span className="font-medium text-white">UPI</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
