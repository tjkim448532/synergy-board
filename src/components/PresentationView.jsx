import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import './PresentationView.css';

export default function PresentationView({ slides, onClose }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') nextSlide();
      else if (e.key === 'ArrowLeft') prevSlide();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide]);

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) setCurrentSlide(curr => curr + 1);
  };

  const prevSlide = () => {
    if (currentSlide > 0) setCurrentSlide(curr => curr - 1);
  };

  return (
    <div className="presentation-overlay">
      <button className="close-btn" onClick={onClose}><X size={32} /></button>
      
      <div className="presentation-controls">
        <button className="nav-btn" onClick={prevSlide} disabled={currentSlide === 0}>
          <ChevronLeft size={48} />
        </button>
      </div>

      <div className="slide-content-wrapper">
        <div 
          className="slide-track" 
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {slides.map((slide, index) => (
            <div key={index} className="slide-pane">
              {slide}
            </div>
          ))}
        </div>
      </div>

      <div className="presentation-controls">
        <button className="nav-btn" onClick={nextSlide} disabled={currentSlide === slides.length - 1}>
          <ChevronRight size={48} />
        </button>
      </div>

      <div className="slide-indicators">
        {slides.map((_, index) => (
          <div 
            key={index} 
            className={`indicator-dot ${currentSlide === index ? 'active' : ''}`}
            onClick={() => setCurrentSlide(index)}
          />
        ))}
      </div>
    </div>
  );
}
