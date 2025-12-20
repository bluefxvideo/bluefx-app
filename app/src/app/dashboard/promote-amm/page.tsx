'use client';

import { useState } from 'react';
import {
  Star,
  DollarSign,
  TrendingUp,
  Users,
  Video,
  Scissors,
  ExternalLink,
  Copy,
  CheckCircle,
  Calculator,
  Gift,
  Zap,
  Youtube,
  ArrowRight,
} from 'lucide-react';
import { StandardToolPage } from '@/components/tools/standard-tool-page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function PromoteAMMPage() {
  const [referrals, setReferrals] = useState(10);
  const [copied, setCopied] = useState(false);
  const [clickbankId, setClickbankId] = useState('');

  // AMM affiliate stats
  const monthlyPrice = 37;
  const commissionRate = 0.5; // 50%
  const avgRetentionMonths = 6;
  const conversionRate = 7.2;

  const monthlyEarnings = referrals * monthlyPrice * commissionRate;
  const yearlyEarnings = monthlyEarnings * 12;
  const lifetimeValue = referrals * monthlyPrice * commissionRate * avgRetentionMonths;

  const affiliateLink = clickbankId.trim()
    ? `https://bluefx.net/amm/ai-media-machine/?affiliate=${clickbankId.trim()}`
    : 'https://bluefx.net/amm/ai-media-machine/';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(affiliateLink);
    setCopied(true);
    toast.success('Affiliate link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <StandardToolPage
      icon={Star}
      title="Promote AI Media Machine"
      description="Earn 50% recurring commission promoting the tool you're already using"
      iconGradient="bg-gradient-to-br from-primary to-primary/70"
      toolName="Promote AMM"
    >
      <div className="h-full overflow-auto p-4 lg:p-8 space-y-8">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary rounded-full mb-4">
            <Gift className="w-4 h-4" />
            <span className="text-sm font-medium">Exclusive Member Opportunity</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Earn <span className="text-primary">50% Recurring Commission</span> Every Month
          </h1>
          <p className="text-lg text-zinc-400">
            You're already using AI Media Machine. Now help others discover it and earn passive income every month they stay subscribed.
          </p>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-zinc-800/50 border-zinc-700">
            <CardContent className="p-4 text-center">
              <DollarSign className="w-8 h-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">$18.50</div>
              <div className="text-xs text-zinc-400">Per Referral/Month</div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-800/50 border-zinc-700">
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-8 h-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">7.2%</div>
              <div className="text-xs text-zinc-400">Conversion Rate</div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-800/50 border-zinc-700">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">6+ months</div>
              <div className="text-xs text-zinc-400">Avg. Retention</div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-800/50 border-zinc-700">
            <CardContent className="p-4 text-center">
              <Zap className="w-8 h-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-white">$111+</div>
              <div className="text-xs text-zinc-400">Per Customer LTV</div>
            </CardContent>
          </Card>
        </div>

        {/* Commission Calculator */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              Commission Calculator
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  How many people will you refer?
                </label>
                <Input
                  type="number"
                  value={referrals}
                  onChange={(e) => setReferrals(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                  className="text-2xl font-bold h-14"
                />
                <p className="text-xs text-zinc-500 mt-2">
                  With 7.2% conversion, you need ~{Math.ceil(referrals / 0.072)} visitors
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-zinc-800/50 rounded-lg">
                  <span className="text-zinc-400">Monthly Earnings</span>
                  <span className="text-xl font-bold text-white">${monthlyEarnings.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-zinc-800/50 rounded-lg">
                  <span className="text-zinc-400">Yearly Projection</span>
                  <span className="text-xl font-bold text-white">${yearlyEarnings.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/30">
                  <span className="text-zinc-300">Customer Lifetime Value</span>
                  <span className="text-2xl font-bold text-primary">${lifetimeValue.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Get Your Link */}
        <Card className="bg-primary/5 border-primary/30">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Ready to Start Earning?</h3>
                <p className="text-zinc-400">Sign up to ClickBank first, then generate your unique affiliate link.</p>
              </div>
              <Button
                variant="outline"
                size="lg"
                onClick={() => window.open('https://www.clickbank.com/', '_blank')}
                className="gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Sign Up to ClickBank
              </Button>
            </div>

            {/* Affiliate Link Generator */}
            <div className="p-4 bg-zinc-800/50 rounded-lg space-y-3">
              <label className="block text-sm text-zinc-400">
                Enter your ClickBank ID to generate your affiliate link:
              </label>
              <div className="flex gap-3">
                <Input
                  type="text"
                  placeholder="Your ClickBank ID"
                  value={clickbankId}
                  onChange={(e) => setClickbankId(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleCopyLink}
                  className="gap-2"
                  disabled={!clickbankId.trim()}
                >
                  {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </Button>
              </div>
              {clickbankId.trim() && (
                <p className="text-xs text-zinc-500 break-all">
                  Your link: <span className="text-primary">{affiliateLink}</span>
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => window.open('https://bluefx.net/affiliates/', '_blank')}
                className="gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Affiliate Resources
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* YouTube Video Clips - Special Perk */}
        <Card className="border-zinc-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Youtube className="w-5 h-5 text-red-500" />
              Exclusive: Use Our YouTube Videos
              <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded-full ml-2">
                Member Perk
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-zinc-400">
              As a member, you have permission to clip segments from our YouTube channel videos
              and use them to promote AI Media Machine. Our videos have established credibility
              and great engagement - leverage that for your promotions!
            </p>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <Video className="w-6 h-6 text-primary mb-2" />
                <h4 className="font-medium text-white mb-1">Tutorial Clips</h4>
                <p className="text-sm text-zinc-500">Show how easy it is to use AMM features</p>
              </div>
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <Scissors className="w-6 h-6 text-primary mb-2" />
                <h4 className="font-medium text-white mb-1">Result Showcases</h4>
                <p className="text-sm text-zinc-500">Share impressive outputs from the tool</p>
              </div>
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <TrendingUp className="w-6 h-6 text-primary mb-2" />
                <h4 className="font-medium text-white mb-1">Proven Engagement</h4>
                <p className="text-sm text-zinc-500">Videos already have views & social proof</p>
              </div>
            </div>

            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.open('https://youtube.com/channel/UCiXb0GsKv0KiFrW6ho5Gk3Q/', '_blank')}
            >
              <Youtube className="w-4 h-4 text-red-500" />
              Visit YouTube Channel
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Why Promote AMM */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Why Promote AI Media Machine?</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
              <CheckCircle className="w-5 h-5 text-primary mb-2" />
              <h4 className="font-medium text-white mb-1">You Already Use It</h4>
              <p className="text-sm text-zinc-400">
                You know the product inside out. Your authentic experience makes selling easy.
              </p>
            </div>
            <div className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
              <CheckCircle className="w-5 h-5 text-primary mb-2" />
              <h4 className="font-medium text-white mb-1">Recurring Revenue</h4>
              <p className="text-sm text-zinc-400">
                Get paid every month as long as your referrals stay subscribed. True passive income.
              </p>
            </div>
            <div className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
              <CheckCircle className="w-5 h-5 text-primary mb-2" />
              <h4 className="font-medium text-white mb-1">High Conversion Rate</h4>
              <p className="text-sm text-zinc-400">
                Our $1 trial and optimized sales page convert at 7.2% - well above industry average.
              </p>
            </div>
            <div className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
              <CheckCircle className="w-5 h-5 text-primary mb-2" />
              <h4 className="font-medium text-white mb-1">Low Churn</h4>
              <p className="text-sm text-zinc-400">
                Average retention of 6+ months means you keep earning from each referral longer.
              </p>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <Card className="border-zinc-700">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3 border border-zinc-700">
                  <span className="text-white font-bold">1</span>
                </div>
                <h4 className="font-medium text-white mb-1">Sign Up to ClickBank</h4>
                <p className="text-sm text-zinc-400">Create your free affiliate account</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3 border border-zinc-700">
                  <span className="text-white font-bold">2</span>
                </div>
                <h4 className="font-medium text-white mb-1">Get Your Link</h4>
                <p className="text-sm text-zinc-400">Copy your unique affiliate link</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3 border border-zinc-700">
                  <span className="text-white font-bold">3</span>
                </div>
                <h4 className="font-medium text-white mb-1">Share & Promote</h4>
                <p className="text-sm text-zinc-400">Use our videos, create content, share on social</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-3 border border-primary/30">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-medium text-white mb-1">Get Paid Monthly</h4>
                <p className="text-sm text-zinc-400">50% of $37/month for as long as they stay</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Frequently Asked Questions</h2>
          <div className="space-y-3">
            <details className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50 group">
              <summary className="font-medium text-white cursor-pointer">
                When do I get paid?
              </summary>
              <p className="text-sm text-zinc-400 mt-2">
                ClickBank pays out every two weeks. Once you hit the minimum threshold ($100),
                your earnings are automatically sent to your bank or PayPal.
              </p>
            </details>
            <details className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50 group">
              <summary className="font-medium text-white cursor-pointer">
                Do I need a ClickBank account?
              </summary>
              <p className="text-sm text-zinc-400 mt-2">
                Yes, you'll need a free ClickBank account to get your affiliate link and receive payments.
                Sign up at clickbank.com if you don't have one.
              </p>
            </details>
            <details className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50 group">
              <summary className="font-medium text-white cursor-pointer">
                Can I really use your YouTube videos?
              </summary>
              <p className="text-sm text-zinc-400 mt-2">
                Yes! As an active member, you have permission to clip and use segments from our
                official YouTube channel for promoting AI Media Machine. Just add your affiliate link.
              </p>
            </details>
            <details className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50 group">
              <summary className="font-medium text-white cursor-pointer">
                How long is the cookie duration?
              </summary>
              <p className="text-sm text-zinc-400 mt-2">
                ClickBank uses a 60-day cookie. If someone clicks your link and purchases within
                60 days, you get credit for the sale and all recurring payments.
              </p>
            </details>
          </div>
        </div>
      </div>
    </StandardToolPage>
  );
}
