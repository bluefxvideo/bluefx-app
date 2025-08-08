import { 
  HeroWithMockup, 
  LandingNav, 
  Features, 
  Solution, 
  Arsenal, 
  Pricing, 
  Testimonials, 
  FinalCTA, 
  Footer 
} from "@/components/home-page"

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-foreground">
      {/* Navigation Header */}
      <LandingNav />
      
      {/* Hero Section */}
      <div className="pt-16">
        <HeroWithMockup
          title={
            <>
              <span className="block">What if You Had 12 AI</span>
              <span className="block">Employees</span>
              <span className="block">Creating 50+ Pieces of Content</span>
              <span className="block text-blue-400">Every Week?</span>
            </>
          }
          description={
            <>
              Videos, ebooks, graphics, music... all professionally done. <br />
              Without showing your face. Without any tech skills.
            </>
          }
          primaryCta={{
            text: "Get Instant Access for $1",
            href: "/dashboard",
          }}
          secondaryCta={{
            text: "See All 12 Apps",
            href: "#arsenal",
          }}
          youtubeVideoId="q69APNW2PbE"
        />
        
        {/* Problem Section */}
        <Features />
        
        {/* Solution Section */}
        <Solution />
        
        {/* Arsenal Section */}
        <Arsenal />
        
        {/* Pricing Section */}
        <Pricing />
        
        {/* Testimonials Section */}
        <Testimonials />
        
        {/* Final CTA Section */}
        <FinalCTA />
      </div>
      
      {/* Footer */}
      <Footer />
    </div>
  )
}
