export const uploadImageToCloudinary = async (file, progressCallback, imageType) => {
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  
  if (!uploadPreset || !cloudName) {
      console.error('Missing Cloudinary config:', { uploadPreset, cloudName });
      throw new Error('Cloudinary configuration missing');
  }

  if (!file.type.startsWith('image/')) {
      throw new Error('Only image files are allowed');
  }

  const folderMap = {
      category: 'e-commerce/category-images',
      product: 'e-commerce/product-images',
      user: 'e-commerce/user-avatars',
      banner: 'e-commerce/banners',
      default: 'e-commerce/general'
  };

  const folder = folderMap[imageType] || folderMap.default;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', folder);

  return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, true);
      
      if (typeof progressCallback === 'function') {
          xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                  const progress = Math.round((event.loaded / event.total) * 100);
                  progressCallback(progress);
              }
          };
      }

      xhr.onload = () => {
          if (xhr.status === 200) {
              try {
                  const response = JSON.parse(xhr.responseText);
                  resolve({
                      url: response.secure_url,
                      publicId: response.public_id,
                      folder: response.folder
                  });
              } catch (error) {
                  console.error('Error parsing response:', error);
                  reject(new Error('Failed to parse upload response'));
              }
          } else {
              console.error('Upload failed with status:', xhr.status, 'Response:', xhr.responseText);
              reject(new Error(`Upload failed with status ${xhr.status}`));
          }
      };

      xhr.onerror = () => {
          console.error('Upload error occurred');
          reject(new Error('Image upload failed'));
      };

      xhr.onabort = () => {
          reject(new Error('Image upload aborted'));
      };

      xhr.send(formData);
  });
};

// Deleting images needs the Cloudinary API secret, which must never be shipped to the
// browser (every VITE_ variable is bundled into the public JavaScript). If deleting is
// needed later, do it in a server function under api/, reading CLOUDINARY_API_SECRET.
