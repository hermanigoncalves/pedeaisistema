import React, { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { tourSteps } from '@/lib/tour-steps';

interface TourGuideProps {
    run?: boolean;
    onFinish?: () => void;
}

const TourGuide: React.FC<TourGuideProps> = ({ run = false, onFinish }) => {
    const [runTour, setRunTour] = useState(run);

    useEffect(() => {
        setRunTour(run);
    }, [run]);

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status } = data;
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

        if (finishedStatuses.includes(status)) {
            setRunTour(false);
            onFinish?.();
        }
    };

    return (
        <Joyride
            steps={tourSteps}
            run={runTour}
            continuous
            showProgress
            showSkipButton
            callback={handleJoyrideCallback}
            styles={{
                options: {
                    primaryColor: '#ea1616',
                    zIndex: 10000,
                },
                tooltip: {
                    borderRadius: 12,
                    backgroundColor: '#1f2937',
                    color: '#f3f4f6',
                },
                buttonNext: {
                    backgroundColor: '#ea1616',
                    borderRadius: 8,
                    padding: '8px 16px',
                },
                buttonBack: {
                    color: '#9ca3af',
                    marginRight: 8,
                },
                buttonSkip: {
                    color: '#9ca3af',
                },
            }}
            locale={{
                back: 'Voltar',
                close: 'Fechar',
                last: 'Finalizar',
                next: 'Próximo',
                skip: 'Pular Tour',
            }}
        />
    );
};

export default TourGuide;
