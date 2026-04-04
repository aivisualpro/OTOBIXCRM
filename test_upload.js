const fs = require('node:fs')

async function testUpload() {
  const token = 'QmFwR0RjLjJmMzkyMjJw98UNpMGFqpgGJV6BXgQ1ye12d100f5c'

  // Create dummy image file
  fs.writeFileSync('dummy.jpg', 'fake image content')

  const FormData = require('form-data')
  const form = new FormData()
  form.append('appointmentId', 'test-appointment-123')
  form.append('imagesList', fs.createReadStream('dummy.jpg'))

  const response = await fetch('https://ob-dealerapp-kong.onrender.com/api/otobix/car/upload-car-images-to-cloudinary', {
    method: 'POST',
    body: form,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  console.log('Status Base Bearer:', response.status)
  const text = await response.text()
  console.log('Body:', text)
}

testUpload()
