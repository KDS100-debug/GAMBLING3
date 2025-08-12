import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useWebSocket } from "@/hooks/useWebSocket";
import { 
  ShieldCheckIcon, 
  IndianRupeeIcon, 
  WalletIcon, 
  TrendingUpIcon, 
  TrendingDownIcon,
  CheckIcon,
  XIcon,
  UsersIcon,
  BellIcon,
  SettingsIcon
} from "lucide-react";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Check admin authentication
  const adminToken = localStorage.getItem('adminToken');
  if (!adminToken) {
    window.location.href = '/admin/login';
    return null;
  }

  // WebSocket for real-time notifications
  const { sendMessage } = useWebSocket(`ws://localhost:5000/admin-ws?token=${adminToken}`, {
    onMessage: (data) => {
      if (data.type === 'payment_notification') {
        toast({
          title: "New Payment Received!",
          description: `₹${data.data.amount} payment from Player ${data.data.userId}`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/payments/pending'] });
      }
    }
  });

  // Dashboard statistics
  const { data: dashboardStats } = useQuery({
    queryKey: ['/api/admin/dashboard/stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/dashboard/stats', {}, {
        Authorization: `Bearer ${adminToken}`
      });
      return response.json();
    }
  });

  // Pending payments
  const { data: pendingPayments } = useQuery({
    queryKey: ['/api/admin/payments/pending'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/payments/pending', {}, {
        Authorization: `Bearer ${adminToken}`
      });
      return response.json();
    }
  });

  // Pending withdrawals
  const { data: pendingWithdrawals } = useQuery({
    queryKey: ['/api/admin/withdrawals/pending'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/withdrawals/pending', {}, {
        Authorization: `Bearer ${adminToken}`
      });
      return response.json();
    }
  });

  // Approve payment
  const approvePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const response = await apiRequest('POST', `/api/admin/payments/${paymentId}/approve`, {}, {
        Authorization: `Bearer ${adminToken}`
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Payment approved successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/payments/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard/stats'] });
    }
  });

  // Process withdrawal
  const processWithdrawalMutation = useMutation({
    mutationFn: async (withdrawalId: string) => {
      const response = await apiRequest('POST', `/api/admin/withdrawals/${withdrawalId}/complete`, {}, {
        Authorization: `Bearer ${adminToken}`
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Withdrawal processed successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/withdrawals/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard/stats'] });
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-purple-900">
      {/* Header */}
      <div className="bg-gray-800/90 border-b border-gray-700 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ShieldCheckIcon className="w-8 h-8 text-red-400" />
            <h1 className="text-2xl font-bold text-white">GameHub Admin</h1>
          </div>
          <div className="flex items-center space-x-4">
            <BellIcon className="w-6 h-6 text-gray-400" />
            <Button variant="ghost" className="text-white" onClick={() => {
              localStorage.removeItem('adminToken');
              window.location.href = '/admin/login';
            }}>
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-6">
        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-gray-800/50 p-1 rounded-lg mb-6">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUpIcon },
            { id: 'payments', label: 'Pending Payments', icon: IndianRupeeIcon },
            { id: 'withdrawals', label: 'Pending Withdrawals', icon: WalletIcon },
            { id: 'settings', label: 'Settings', icon: SettingsIcon }
          ].map(tab => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'ghost'}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 ${activeTab === tab.id ? 'bg-red-600' : 'text-gray-300'}`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border-green-600/30">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-400 text-sm font-medium">Total Payments</p>
                      <p className="text-2xl font-bold text-white">₹{dashboardStats?.totalPayments || 0}</p>
                    </div>
                    <TrendingUpIcon className="w-8 h-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-600/20 to-orange-600/20 border-red-600/30">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-400 text-sm font-medium">Total Withdrawals</p>
                      <p className="text-2xl font-bold text-white">₹{dashboardStats?.totalWithdrawals || 0}</p>
                    </div>
                    <TrendingDownIcon className="w-8 h-8 text-red-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-blue-600/30">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-400 text-sm font-medium">Pending Approvals</p>
                      <p className="text-2xl font-bold text-white">{dashboardStats?.pendingPayments || 0}</p>
                    </div>
                    <BellIcon className="w-8 h-8 text-blue-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border-purple-600/30">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-400 text-sm font-medium">Active Users</p>
                      <p className="text-2xl font-bold text-white">{dashboardStats?.activeUsers || 0}</p>
                    </div>
                    <UsersIcon className="w-8 h-8 text-purple-400" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Pending Payments Tab */}
        {activeTab === 'payments' && (
          <Card className="bg-gray-800/80 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Pending Payment Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingPayments?.length > 0 ? (
                <div className="space-y-4">
                  {pendingPayments.map((payment: any) => (
                    <div key={payment.id} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4">
                          <div>
                            <p className="text-white font-semibold">Player: {payment.userId}</p>
                            <p className="text-gray-400 text-sm">Amount: ₹{payment.amount} → {payment.pointsToCredit} points</p>
                            {payment.payerUpiId && (
                              <p className="text-gray-400 text-sm">UPI: {payment.payerUpiId}</p>
                            )}
                            {payment.paymentTransactionId && (
                              <p className="text-gray-400 text-sm">Transaction ID: {payment.paymentTransactionId}</p>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-500 text-xs mt-2">
                          Requested: {new Date(payment.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          onClick={() => approvePaymentMutation.mutate(payment.id)}
                          disabled={approvePaymentMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckIcon className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive">
                          <XIcon className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-8">No pending payments</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pending Withdrawals Tab */}
        {activeTab === 'withdrawals' && (
          <Card className="bg-gray-800/80 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Pending Withdrawal Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingWithdrawals?.length > 0 ? (
                <div className="space-y-4">
                  {pendingWithdrawals.map((withdrawal: any) => (
                    <div key={withdrawal.id} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                      <div className="flex-1">
                        <div>
                          <p className="text-white font-semibold">Player: {withdrawal.userId}</p>
                          <p className="text-gray-400 text-sm">
                            Withdraw: {withdrawal.pointsToWithdraw} points → ₹{withdrawal.withdrawalAmount}
                          </p>
                          <p className="text-gray-400 text-sm">UPI ID: {withdrawal.recipientUpiId}</p>
                        </div>
                        <p className="text-gray-500 text-xs mt-2">
                          Requested: {new Date(withdrawal.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          onClick={() => processWithdrawalMutation.mutate(withdrawal.id)}
                          disabled={processWithdrawalMutation.isPending}
                          className="bg-orange-600 hover:bg-orange-700"
                        >
                          <CheckIcon className="w-4 h-4 mr-1" />
                          Mark Paid
                        </Button>
                        <Button size="sm" variant="destructive">
                          <XIcon className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-8">No pending withdrawals</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-800/80 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Conversion Rates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-gray-300 text-sm">Top-up Rate (Points per ₹1)</label>
                  <Input className="bg-gray-700 border-gray-600 text-white mt-1" defaultValue="10" />
                </div>
                <div>
                  <label className="text-gray-300 text-sm">Withdrawal Rate (₹ per Point)</label>
                  <Input className="bg-gray-700 border-gray-600 text-white mt-1" defaultValue="0.08" />
                </div>
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  Update Rates
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/80 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Payment QR Code</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="w-32 h-32 mx-auto bg-gray-700 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-gray-500">QR Code</span>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">ashishalamkabir@idfc</p>
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    Upload New QR Code
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}