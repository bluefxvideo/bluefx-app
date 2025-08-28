'use client';

import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TawkToWidget } from './tawk-to-widget';

export function LiveChatButton() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleChatToggle = () => {
    setIsChatOpen(!isChatOpen);
  };

  const handleChatClose = () => {
    setIsChatOpen(false);
  };

  return (
    <>
      <Button
        onClick={handleChatToggle}
        className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl transition-all duration-300"
        size="sm"
      >
        {isChatOpen ? (
          <>
            <X className="w-4 h-4 mr-2" />
            Close Chat
          </>
        ) : (
          <>
            <MessageCircle className="w-4 h-4 mr-2" />
            Live Chat
          </>
        )}
      </Button>
      
      {/* Only render Tawk.to widget when chat should be visible */}
      {isChatOpen && (
        <TawkToWidget 
          isVisible={isChatOpen} 
          onClose={handleChatClose}
        />
      )}
    </>
  );
}