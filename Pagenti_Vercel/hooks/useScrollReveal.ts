import { useEffect } from 'react';

/**
 * useScrollReveal
 * A hook that uses Intersection Observer to add 'active' class to elements with 'reveal' class
 * when they enter the viewport. Now uses MutationObserver to handle dynamically added content.
 */
export const useScrollReveal = () => {
    useEffect(() => {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, observerOptions);

        // Function to observe initial and new elements
        const observeElements = () => {
            const revealElements = document.querySelectorAll('.reveal:not(.active)');
            revealElements.forEach((el) => revealObserver.observe(el));
        };

        // Initial observation
        observeElements();

        // MutationObserver to watch for newly added .reveal elements
        const mutationObserver = new MutationObserver((mutations) => {
            let hasNewReveals = false;
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node instanceof HTMLElement) {
                        if (node.classList.contains('reveal') || node.querySelector('.reveal')) {
                            hasNewReveals = true;
                        }
                    }
                });
            });
            if (hasNewReveals) observeElements();
        });

        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        return () => {
            revealObserver.disconnect();
            mutationObserver.disconnect();
        };
    }, []);
};
