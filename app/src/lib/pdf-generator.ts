'use client';

import jsPDF from 'jspdf';

interface EbookContent {
  title: string;
  author?: string;
  chapters: {
    title: string;
    content: string;
  }[];
  cover?: {
    image_url: string;
  };
}

/**
 * Generate and download PDF from ebook content (client-side)
 */
export async function generateAndDownloadPDF(ebook: EbookContent): Promise<void> {
  try {
    // Create new PDF document
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Set document properties
    pdf.setProperties({
      title: ebook.title,
      author: ebook.author || 'Unknown Author',
      creator: 'BlueFX Ebook Writer'
    });
    
    // Helper function to add text with word wrap
    const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number): number => {
      const lines = pdf.splitTextToSize(text, maxWidth);
      lines.forEach((line: string, index: number) => {
        if (y + (index * lineHeight) > 270) {
          pdf.addPage();
          y = 20;
        }
        pdf.text(line, x, y + (index * lineHeight));
      });
      return y + (lines.length * lineHeight);
    };
    
    let currentY = 20;
    
    // COVER PAGE (if image exists)
    if (ebook.cover?.image_url) {
      try {
        // Load image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = ebook.cover.image_url;
        });
        
        // Add cover image centered on first page
        const imgWidth = 120; // Width in mm
        const imgHeight = 180; // Height in mm (maintaining 2:3 aspect ratio)
        const x = (210 - imgWidth) / 2;
        const y = (297 - imgHeight) / 2;
        
        pdf.addImage(img, 'JPEG', x, y, imgWidth, imgHeight);
        pdf.addPage();
      } catch (error) {
        console.warn('Could not load cover image:', error);
        // Continue without cover image
      }
    }
    
    // TITLE PAGE
    pdf.setFontSize(32);
    pdf.setFont('helvetica', 'bold');
    const titleLines = pdf.splitTextToSize(ebook.title, 170);
    const titleHeight = titleLines.length * 12;
    const titleY = 100; // Center vertically
    titleLines.forEach((line: string, index: number) => {
      const textWidth = pdf.getTextWidth(line);
      const textX = (210 - textWidth) / 2; // Center horizontally
      pdf.text(line, textX, titleY + (index * 12));
    });
    
    // Author
    if (ebook.author) {
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'italic');
      const authorY = titleY + titleHeight + 20;
      const authorText = `by ${ebook.author}`;
      const authorWidth = pdf.getTextWidth(authorText);
      pdf.text(authorText, (210 - authorWidth) / 2, authorY);
    }
    
    // TABLE OF CONTENTS
    pdf.addPage();
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Table of Contents', 20, 30);
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    currentY = 45;
    
    ebook.chapters.forEach((chapter, index) => {
      // Skip skipped chapters
      if (chapter.content === '<!SKIPPED!>') return;
      
      const chapterTitle = `${index + 1}. ${chapter.title}`;
      pdf.text(chapterTitle, 25, currentY);
      currentY += 8;
      
      if (currentY > 270) {
        pdf.addPage();
        currentY = 30;
      }
    });
    
    // CHAPTERS
    ebook.chapters.forEach((chapter, chapterIndex) => {
      // Skip skipped chapters
      if (chapter.content === '<!SKIPPED!>') return;
      
      // New page for each chapter
      pdf.addPage();
      
      // Chapter title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      const chapterTitle = `Chapter ${chapterIndex + 1}: ${chapter.title}`;
      currentY = addWrappedText(chapterTitle, 20, 30, 170, 8);
      
      // Add space after title
      currentY += 10;
      
      // Chapter content
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      
      // Clean and split content into paragraphs
      const cleanContent = chapter.content
        .replace(/\*\*/g, '') // Remove bold markdown
        .replace(/\*/g, '')   // Remove italic markdown
        .replace(/#{1,6}\s/g, '') // Remove heading markdown
        .replace(/`/g, '');   // Remove code markdown
      
      const paragraphs = cleanContent.split('\n\n').filter(p => p.trim());
      
      paragraphs.forEach(paragraph => {
        // Check if we need a new page
        if (currentY > 250) {
          pdf.addPage();
          currentY = 30;
        }
        
        // Add paragraph with proper spacing
        const lines = pdf.splitTextToSize(paragraph.trim(), 170);
        lines.forEach((line: string) => {
          if (currentY > 270) {
            pdf.addPage();
            currentY = 30;
          }
          pdf.text(line, 20, currentY);
          currentY += 5.5; // Line spacing
        });
        
        // Add space between paragraphs
        currentY += 6;
      });
    });
    
    // Generate filename
    const filename = `${ebook.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    
    // Download the PDF
    pdf.save(filename);
    
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error('Failed to generate PDF');
  }
}