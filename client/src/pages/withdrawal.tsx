import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Navigation from "@/components/navigation";
import { ArrowLeftIcon, BanknoteIcon, IndianRupeeIcon, WalletIcon } from "lucide-react";
import { Link } from "wouter";

export default function Withdrawal() {
  const [pointsToWithdraw, setPointsToWithdraw] = useState(100);
  const [upiId, setUpiId] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get user balance
  const { data: balance } = useQuery({
    queryKey: ['/api/balance'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/balance');
      const data = await response.json();
      return data.balance;
    }
  });

  // Get withdrawal conversion rate (1 point = 0.08 INR by default)
  const { data: conversionRate } = useQuery({
    queryKey: ['/api/admin/config/withdrawal-rate'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/config/withdrawal-rate');
      return response.json();
    }
  });

  // Calculate withdrawal amount
  const withdrawalAmount = pointsToWithdraw * (conversionRate?.rate || 0.08);

  const createWithdrawalRequestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/withdrawal/create-request', {
        pointsToWithdraw,
        upiId,
        withdrawalAmount: withdrawalAmount,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Withdrawal Request Submitted",
        description: `Your request to withdraw ${pointsToWithdraw} points (₹${withdrawalAmount.toFixed(2)}) has been submitted for admin approval.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/withdrawal/requests'] });
      setPointsToWithdraw(100);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create withdrawal request",
        variant: "destructive",
      });
    }
  });

  const { data: userWithdrawalRequests } = useQuery({
    queryKey: ['/api/withdrawal/requests'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/withdrawal/requests');
      return response.json();
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-white hover:bg-white/10 mb-4">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          
          <h1 className="text-4xl font-bold text-white mb-2">Withdraw Points</h1>
          <p className="text-gray-300">Convert your points back to cash via UPI transfer</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Withdrawal Form */}
          <Card className="bg-gray-800/80 border-gray-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <BanknoteIcon className="w-5 h-5 mr-2" />
                Withdrawal Request
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current Balance */}
              <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Current Balance:</span>
                  <div className="flex items-center">
                    <WalletIcon className="w-4 h-4 text-purple-400 mr-1" />
                    <span className="text-white font-bold">{balance || 0} points</span>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="points" className="text-gray-300">Points to Withdraw</Label>
                <Input
                  id="points"
                  type="number"
                  min="10"
                  max={balance || 0}
                  value={pointsToWithdraw}
                  onChange={(e) => setPointsToWithdraw(Number(e.target.value))}
                  className="bg-gray-700 border-gray-600 text-white"
                />
                <div className="text-sm text-gray-400 mt-1">
                  You will receive: <span className="text-green-400 font-semibold">₹{withdrawalAmount.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <Label htmlFor="upi" className="text-gray-300">UPI ID for Transfer</Label>
                <Input
                  id="upi"
                  type="text"
                  placeholder="your-upi-id@bank"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
                <div className="text-sm text-gray-400 mt-1">
                  Make sure this UPI ID is active and correct
                </div>
              </div>

              <Button
                onClick={() => createWithdrawalRequestMutation.mutate()}
                disabled={
                  createWithdrawalRequestMutation.isPending || 
                  !pointsToWithdraw || 
                  !upiId || 
                  pointsToWithdraw > (balance || 0) ||
                  pointsToWithdraw < 10
                }
                className="w-full bg-gradient-to-r from-orange-600 to-red-700 hover:from-orange-700 hover:to-red-800"
              >
                {createWithdrawalRequestMutation.isPending ? "Submitting..." : "Request Withdrawal"}
              </Button>
            </CardContent>
          </Card>

          {/* Withdrawal Info */}
          <Card className="bg-gray-800/80 border-gray-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Withdrawal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Conversion Rate:</span>
                  <span className="text-white">1 point = ₹{(conversionRate?.rate || 0.08).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Minimum Withdrawal:</span>
                  <span className="text-white">10 points</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Processing Time:</span>
                  <span className="text-white">1-24 hours</span>
                </div>
              </div>

              <div className="bg-yellow-600/20 p-4 rounded-lg border border-yellow-600/30">
                <h4 className="text-yellow-400 font-semibold mb-2">Important Notes:</h4>
                <ul className="text-yellow-200 text-sm space-y-1">
                  <li>• Withdrawals are processed manually by admin</li>
                  <li>• Make sure your UPI ID is correct and active</li>
                  <li>• You will receive a notification once processed</li>
                  <li>• Minimum withdrawal amount is 10 points</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Withdrawal History */}
        <Card className="bg-gray-800/80 border-gray-700 backdrop-blur-sm mt-8">
          <CardHeader>
            <CardTitle className="text-white">Your Withdrawal Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {userWithdrawalRequests?.length > 0 ? (
              <div className="space-y-4">
                {userWithdrawalRequests.map((request: any) => (
                  <div key={request.id} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                    <div>
                      <div className="flex items-center space-x-2">
                        <WalletIcon className="w-4 h-4 text-purple-400" />
                        <span className="text-white font-semibold">{request.pointsToWithdraw} points</span>
                        <span className="text-gray-400">→</span>
                        <IndianRupeeIcon className="w-4 h-4 text-green-400" />
                        <span className="text-green-400">₹{request.withdrawalAmount}</span>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        UPI: {request.recipientUpiId} | Created: {new Date(request.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <Badge 
                      variant={
                        request.status === 'completed' ? 'default' : 
                        request.status === 'pending' ? 'secondary' : 
                        request.status === 'processing' ? 'outline' :
                        'destructive'
                      }
                    >
                      {request.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">No withdrawal requests yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}