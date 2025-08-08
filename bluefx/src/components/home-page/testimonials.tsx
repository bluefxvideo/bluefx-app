'use client';

import { Button } from '@/components/ui/button';

const testimonials = [
  {
    author: {
      name: "James Wilson, 62",
      location: "Phoenix, AZ",
      avatar: "/James2.png",
      verified: true
    },
    text: "Honestly, at my age I wanted to share some financial tips from my 30+ years in banking but... ugh, being on camera? No thanks. This thing lets me make videos from my home office and they actually look professional. I'm not the most tech-savvy guy lol, but it was pretty straightforward to pick up.",
    rating: 5,
    date: "May 2025"
  },
  {
    author: {
      name: "Barbara Thompson, 58",
      location: "Austin, TX",
      avatar: "/barbara.jpg",
      verified: true
    },
    text: "Always struggled with being on camera for my gardening channel. Used to pay my nephew $200/month just to film simple videos. Now I'm using the AI avatar to create shorts and TikToks in literally 10 minutes - the avatar speaks for me! My local nursery even asked who I hired for video production lol! The thumbnail face swap is incredible too - I can make professional thumbnails without having to pay for them on Fiverr.",
    rating: 5,
    date: "June 2025"
  },
  {
    author: {
      name: "Robert Mitchell, 67",
      location: "Bend, OR",
      avatar: "/Michael.jpg",
      verified: true
    },
    text: "Running a woodworking YouTube channel. Used the logo maker for my brand - saved me $500 right there! The ebook writer is amazing too - created a whole woodworking guide last week. Its not perfect (sometimes the text needs editing) but for the price? No brainer. I thought it would be complicated but honestly my neighbor's kid showed me the basics in an afternoon. Got my first affiliate commission last month - just $47 but hey, it's a start!",
    rating: 4,
    date: "May 2025"
  },
  {
    author: {
      name: "Michael Goldstein, 53",
      location: "Sacramento, CA",
      avatar: "/Robert.jpg",
      verified: false
    },
    text: "Former chef. Started making cooking tutorials 4 months ago without showing my face (camera shy, always have been). Already at 1,850 subscribers! The AI avatar is perfect for quick recipe shorts. Sometimes the AI mispronounces ingredient names, but I just edit those parts out. Looking forward to making this my retirement project!",
    rating: 4,
    date: "May 2025"
  }
];

const StarRating = ({ rating }: { rating: number }) => {
  return (
    <div className="flex items-center mb-3">
      {[...Array(5)].map((_, i) => (
        <svg
          key={i}
          className={`w-5 h-5 ${i < rating ? 'text-yellow-400' : 'text-zinc-700'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
};

export function Testimonials() {
  return (
    <section className="w-full py-24 bg-gray-950 text-white">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-6 uppercase tracking-wider">
            BETA TESTER FEEDBACK
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-white leading-[1.2]">
            What Our Beta Testers Are Saying
          </h2>
          <p className="text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
            Real feedback from early adopters who are already transforming their content creation
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          {testimonials.map((testimonial, index) => {
            const rotations = ['rotate-1', '-rotate-1', 'rotate-0', 'rotate-1'];
            return (
            <div 
              key={index} 
              className={`bg-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-gray-800/50 hover:border-gray-700/50 transition-all ${rotations[index]}`}
            >
              <StarRating rating={testimonial.rating} />
              
              <p className="text-gray-300 text-sm leading-relaxed mb-6 italic">
                "{testimonial.text}"
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full mr-3 overflow-hidden bg-zinc-800">
                    <img 
                      src={testimonial.author.avatar} 
                      alt={testimonial.author.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white text-sm">{testimonial.author.name}</span>
                      {testimonial.author.verified && (
                        <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    {testimonial.author.location && (
                      <div className="text-gray-500 text-xs">{testimonial.author.location}</div>
                    )}
                  </div>
                </div>
                {testimonial.date && (
                  <div className="text-gray-500 text-xs">{testimonial.date}</div>
                )}
              </div>
            </div>
          )}
          )}
        </div>

        {/* Bottom CTA - AI Revolution Card */}
        <div className="text-center bg-gray-900/80 backdrop-blur-sm rounded-2xl p-12 border border-gray-800/50 max-w-5xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black mb-8 text-gray-100 leading-[1.2]">
            The AI Revolution is Happening<br />With or Without You
          </h2>
          
          <div className="mb-8 max-w-4xl mx-auto">
            <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-6 mb-6">
              <p className="text-xl text-red-400 font-bold mb-4">⚠️ THE HARD TRUTH:</p>
              <p className="text-gray-300 mb-4">Every day you wait, someone else is:</p>
              <div className="space-y-2 text-left">
                <div className="flex items-start gap-2">
                  <span className="text-red-400">•</span>
                  <p className="text-gray-300">Creating content YOU should be creating</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-400">•</span>
                  <p className="text-gray-300">Ranking for keywords YOU should own</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-400">•</span>
                  <p className="text-gray-300">Making money YOU should be making</p>
                </div>
              </div>
            </div>
            
            <p className="text-lg text-gray-300 mb-6">
              In 5 years, there will be two types of businesses:<br/>
              <span className="text-green-400 font-semibold">Those powered by AI</span> and <span className="text-red-400 font-semibold">those that no longer exist</span>.
            </p>
            
            <p className="text-gray-400">
              Join thousands of creators already dominating with AI.<br/>
              Don't become another casualty of the revolution.
            </p>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <div className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 p-1 rounded-lg">
              <Button className="bg-gray-900 hover:bg-gray-800 text-white px-10 py-5 rounded-lg font-bold text-xl transition-all">
                🚀 Get Instant Access for $1
              </Button>
            </div>
            <p className="text-sm text-gray-400">
              Then $37/month • Cancel anytime • No hidden fees
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}