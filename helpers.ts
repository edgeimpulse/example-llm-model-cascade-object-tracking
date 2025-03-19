import sharp from 'sharp';
import { ModelInformation } from 'edge-impulse-linux';
import { RunnerClassifyResponseSuccess } from 'edge-impulse-linux/build/library/classifier/linux-impulse-runner';

export async function findObjectsInImage(img: Buffer, ev: RunnerClassifyResponseSuccess, model: ModelInformation) {
    const objectTrackingObjects = ev.result.object_tracking || [];

    let imgMetadata = await sharp(img).metadata();

    // first need to resize the img to same shape os modelParameters
    let lowestFactor = Math.min(
        imgMetadata.width! / model.modelParameters.image_input_width,
        imgMetadata.height! / model.modelParameters.image_input_height
    );
    let resizedWidth = Math.round(model.modelParameters.image_input_width * lowestFactor);
    let resizedHeight = Math.round(model.modelParameters.image_input_height * lowestFactor);
    let resizedImg = await sharp(img).resize({
        width: resizedWidth,
        height: resizedHeight,
    });

    let objects: {
        objectId: number,
        label: string,
        imagePng: Buffer,
    }[] = [];

    for (const bb of objectTrackingObjects) {
        let x = Math.round((bb.x) * lowestFactor);
        let y = Math.round((bb.y) * lowestFactor);
        let w = Math.round((bb.width) * lowestFactor);
        let h = Math.round((bb.height) * lowestFactor);

        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x + w > resizedWidth) {
            w = resizedWidth - x;
        }
        if (y + h > resizedHeight) {
            h = resizedHeight - y;
        }

        if (w <= 0 || h <= 0) continue;

        try {
            let img = await resizedImg
                .extract({ left: x, top: y, width: w, height: h })
                .png()
                .toBuffer();
            objects.push({
                objectId: bb.object_id,
                label: bb.label,
                imagePng: img,
            });
        }
        catch (ex2) {
            const ex = <Error>ex2;
            console.log('Failed to cut out object', {
                x,
                y,
                w,
                h,
                error: ex.message || ex.toString(),
            });
            continue;
        }
    }

    return objects;
}
