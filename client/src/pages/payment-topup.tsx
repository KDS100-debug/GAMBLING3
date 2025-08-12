import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Navigation from "@/components/navigation";
import { ArrowLeftIcon, QrCodeIcon, CreditCardIcon, IndianRupeeIcon } from "lucide-react";
import { Link } from "wouter";

export default function PaymentTopup() {
  const [amount, setAmount] = useState(100);
  const [upiId, setUpiId] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Calculate points based on conversion rate (1 INR = 10 points)
  const pointsToReceive = amount * 10;

  const { data: qrCodeData } = useQuery({
    queryKey: ['/api/payment/qr-code'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/payment/qr-code');
      return response.json();
    }
  });

  const { data: conversionRate } = useQuery({
    queryKey: ['/api/admin/config/topup-rate'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/config/topup-rate');
      return response.json();
    }
  });

  const createPaymentRequestMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/payment/create-request', {
        amount,
        upiId,
        pointsToCredit: pointsToReceive,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Payment Request Created",
        description: `Your request for ₹${amount} (${pointsToReceive} points) has been submitted. Please complete the payment using the QR code.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/payment/requests'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create payment request",
        variant: "destructive",
      });
    }
  });

  const { data: userPaymentRequests } = useQuery({
    queryKey: ['/api/payment/requests'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/payment/requests');
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
          
          <h1 className="text-4xl font-bold text-white mb-2">Top Up Points</h1>
          <p className="text-gray-300">Add points to your gaming account using UPI payment</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Payment Form */}
          <Card className="bg-gray-800/80 border-gray-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <CreditCardIcon className="w-5 h-5 mr-2" />
                Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="amount" className="text-gray-300">Amount (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="10"
                  max="10000"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="bg-gray-700 border-gray-600 text-white"
                />
                <div className="text-sm text-gray-400 mt-1">
                  You will receive: <span className="text-green-400 font-semibold">{pointsToReceive} points</span>
                </div>
              </div>

              <div>
                <Label htmlFor="upi" className="text-gray-300">Your UPI ID</Label>
                <Input
                  id="upi"
                  type="text"
                  placeholder="your-upi-id@bank"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
                <div className="text-sm text-gray-400 mt-1">
                  Required for future withdrawals
                </div>
              </div>

              <Button
                onClick={() => createPaymentRequestMutation.mutate()}
                disabled={createPaymentRequestMutation.isPending || !amount || !upiId}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800"
              >
                {createPaymentRequestMutation.isPending ? "Creating Request..." : "Create Payment Request"}
              </Button>
            </CardContent>
          </Card>

          {/* QR Code */}
          <Card className="bg-gray-800/80 border-gray-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <QrCodeIcon className="w-5 h-5 mr-2" />
                Payment QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {qrCodeData?.qrCodeImage ? (
                <div className="text-center">
                  <img 
                    src={qrCodeData.qrCodeImage} 
                    alt="Payment QR Code"
                    className="mx-auto w-64 h-64 border-2 border-gray-600 rounded-lg"
                  />
                  <p className="text-gray-300 mt-4">
                    Scan this QR code with any UPI app to make payment
                  </p>
                  <div className="bg-gray-700 p-3 rounded-lg mt-4">
                    <p className="text-sm text-gray-400">Pay to UPI ID:</p>
                    <p className="text-white font-mono">{qrCodeData.merchantUpiId}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-64 h-64 mx-auto bg-gray-700 rounded-lg flex items-center justify-center">
                    <QrCodeIcon className="w-16 h-16 text-gray-500" />
                  </div>
                  <p className="text-gray-400 mt-4">QR Code not available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payment History */}
        <Card className="bg-gray-800/80 border-gray-700 backdrop-blur-sm mt-8">
          <CardHeader>
            <CardTitle className="text-white">Your Payment Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {userPaymentRequests?.length > 0 ? (
              <div className="space-y-4">
                {userPaymentRequests.map((request: any) => (
                  <div key={request.id} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                    <div>
                      <div className="flex items-center space-x-2">
                        <IndianRupeeIcon className="w-4 h-4 text-green-400" />
                        <span className="text-white font-semibold">₹{request.amount}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-purple-400">{request.pointsToCredit} points</span>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        Created: {new Date(request.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <Badge 
                      variant={
                        request.status === 'approved' ? 'default' : 
                        request.status === 'pending' ? 'secondary' : 
                        'destructive'
                      }
                    >
                      {request.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">No payment requests yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}