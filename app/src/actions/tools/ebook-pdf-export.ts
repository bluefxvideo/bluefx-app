'use server';

import { jsPDF } from 'jspdf';

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
 * Generate PDF from ebook content
 * Simple, clean PDF without complex styling
 */
export async function generateEbookPDF(ebook: EbookContent): Promise<string> {
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
    const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
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
    
    // Title Page
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
      pdf.setFont('helvetica', 'normal');
      const authorY = titleY + titleHeight + 20;
      const authorText = `by ${ebook.author}`;
      const authorWidth = pdf.getTextWidth(authorText);
      pdf.text(authorText, (210 - authorWidth) / 2, authorY);
    }
    
    // Table of Contents
    pdf.addPage();
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Table of Contents', 20, 30);
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    currentY = 45;
    
    ebook.chapters.forEach((chapter, index) => {
      const chapterTitle = `${index + 1}. ${chapter.title}`;
      pdf.text(chapterTitle, 25, currentY);
      currentY += 8;
      
      if (currentY > 270) {
        pdf.addPage();
        currentY = 30;
      }
    });
    
    // Chapters
    ebook.chapters.forEach((chapter, chapterIndex) => {
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
      
      // Split content into paragraphs
      const paragraphs = chapter.content.split('\n\n').filter(p => p.trim());
      
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
          currentY += 5;
        });
        
        // Add space between paragraphs
        currentY += 5;
      });
    });
    
    // Return base64 encoded PDF
    return pdf.output('datauristring');
    
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error('Failed to generate PDF');
  }
}

/**
 * Client-side function to download PDF
 */
export function downloadPDF(pdfDataUri: string, filename: string) {
  // Convert data URI to blob
  const byteString = atob(pdfDataUri.split(',')[1]);
  const mimeString = pdfDataUri.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  
  const blob = new Blob([ab], { type: mimeString });
  const url = URL.createObjectURL(blob);
  
  // Create download link
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}